import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  chooseSourceRequested: vi.fn((origin: unknown, pickerMode?: string) => ({
    origin,
    pickerMode,
    type: "source/choose",
  })),
  closeActiveEditingInstanceRequested: vi.fn((origin: unknown) => ({
    origin,
    type: "source/close",
  })),
  dispatch: vi.fn(),
  diagnosticsError: vi.fn(),
  openOptimizedExportDialog: vi.fn((origin: unknown) => ({
    origin,
    type: "export/optimized",
  })),
  requestSourceDelete: vi.fn(),
  startFastCutRequested: vi.fn((origin: unknown) => ({
    origin,
    type: "export/fast",
  })),
}));

const state = {
  crop: {
    flipHorizontal: false,
    flipVertical: false,
    rotationDegrees: 0,
    value: { height: 1, width: 1, x: 0, y: 0 },
  },
  editingInstances: {
    activeInstanceId: "source-1",
    entities: {
      "source-1": {
        exportAttempts: [],
        id: "source-1",
        snapshot: { source: { displayName: "source.mp4", sourcePath: "C:/source.mp4" } },
        sourceAvailability: "available",
      },
    },
    ids: ["source-1"],
  },
  importWorkflow: { isChoosingSource: false, isNativeDialogOpen: false },
  preferences: {
    activityFeedView: "default",
    autoStartQueueEnabled: true,
    deleteSourceOnRenderFinish: false,
    layoutDensity: "default",
    loopPlaybackEnabledDefault: true,
    mergeAudioEnabledDefault: false,
    primaryColor: "amber",
    segmentPlaybackEnabledDefault: true,
    snapPlaybackEnabledDefault: true,
    themePreference: "system",
  },
  export: { availableQueueFinishActions: ["exit", "nothing"], queueFinishAction: "nothing" },
  source: {
    media: {},
    source: { displayName: "source.mp4", sourcePath: "C:/source.mp4" },
    status: "ready",
  },
};

vi.mock("@/app/store/redux-hooks", () => ({
  useAppDispatch: () => mocks.dispatch,
  useAppSelector: (selector: (value: unknown) => unknown) => selector(state),
}));
vi.mock("@/app/store/thunks/export-thunks", () => ({
  openOptimizedExportDialog: mocks.openOptimizedExportDialog,
  startFastCutRequested: mocks.startFastCutRequested,
}));
vi.mock("@/app/store/thunks/source-media-thunks", () => ({
  chooseSourceRequested: mocks.chooseSourceRequested,
  closeActiveEditingInstanceRequested: mocks.closeActiveEditingInstanceRequested,
}));
vi.mock("@/features/source", () => ({
  useSourceDelete: () => ({ requestSourceDelete: mocks.requestSourceDelete }),
}));
vi.mock("@/features/changelog", () => ({ useChangelogDialog: () => ({ openChangelog: vi.fn() }) }));
vi.mock("@/features/export", () => ({
  useQueueDeleteSource: () => ({ requestEnableSourceDeletion: vi.fn() }),
}));
vi.mock("@/features/preview", () => ({
  usePreviewTransform: () => ({ isAvailable: false, requestCrop: vi.fn(), requestReset: vi.fn() }),
}));
vi.mock("@/app/hooks/useAppUpdates", () => ({
  useAppUpdates: () => ({
    availableVersion: null,
    checkForUpdates: vi.fn(),
    installUpdate: vi.fn(),
    isInstalling: false,
    status: "idle",
  }),
}));
vi.mock("@/components/ui/resizable", () => ({
  usePanelCommand: () => ({
    isAvailable: true,
    isCollapsed: false,
    isDisabled: false,
    isReset: false,
    toggle: vi.fn(),
    reset: vi.fn(),
  }),
}));
vi.mock("@/lib/open-external-url.utils", () => ({ openExternalUrl: vi.fn() }));
vi.mock("@/lib/app-version.utils", () => ({ getCurrentVersion: () => "0.0.0" }));
vi.mock("@/lib/tauri/diagnostics", () => ({ revealDiagnosticLogs: vi.fn() }));
vi.mock("@/lib/tauri/window", () => ({ requestWindowShutdown: vi.fn() }));
vi.mock("@/lib/diagnostics", () => ({
  diagnostics: { error: mocks.diagnosticsError },
}));

import { useApplicationCommands } from "@/app/hooks/useApplicationCommands";

import { ApplicationCommandsProvider } from "../ApplicationCommandsProvider";

function RuntimeProbe() {
  const { commands, executeCommand } = useApplicationCommands();

  return (
    <div>
      {commands.map((command) => (
        <button
          data-checked={command.checked}
          data-pending={command.pending}
          data-section={command.section.label}
          data-variant={command.variant}
          disabled={!command.enabled || command.pending}
          key={command.id}
          onClick={() => void executeCommand(command.id, "palette")}
          type="button"
        >
          {command.id}
        </button>
      ))}
      <button
        disabled={commands.find((command) => command.id === "open-file")?.pending}
        onClick={() => void executeCommand("open-file", "menu")}
        type="button"
      >
        open-file-menu
      </button>
    </div>
  );
}

function renderRuntime() {
  return render(
    <ApplicationCommandsProvider>
      <RuntimeProbe />
    </ApplicationCommandsProvider>,
  );
}

describe("ApplicationCommandsProvider", () => {
  beforeEach(() => {
    mocks.dispatch.mockReset();
    mocks.dispatch.mockImplementation(() => undefined);
    mocks.diagnosticsError.mockClear();
    mocks.requestSourceDelete.mockClear();
    state.importWorkflow.isNativeDialogOpen = false;
  });

  it("executes synchronous commands through the shared runtime and exposes semantic metadata", async () => {
    mocks.dispatch.mockImplementation(() => undefined);
    renderRuntime();

    expect(screen.getByRole("button", { name: "delete-file" })).toHaveAttribute(
      "data-variant",
      "destructive",
    );
    expect(screen.getByRole("button", { name: "theme-system" })).toHaveAttribute(
      "data-section",
      "Appearance / Theme",
    );
    expect(screen.getByRole("button", { name: "primary-color-amber" })).toHaveAttribute(
      "data-section",
      "Appearance / Color",
    );

    fireEvent.click(screen.getByRole("button", { name: "delete-file" }));

    expect(mocks.requestSourceDelete).toHaveBeenCalledWith({ sourceIds: ["source-1"] });
  });

  it("shares pending state and prevents duplicate async execution", async () => {
    let resolveCommand!: () => void;
    mocks.dispatch.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveCommand = resolve;
        }),
    );
    renderRuntime();
    const command = screen.getByRole("button", { name: "open-file" });
    const menuCommand = screen.getByRole("button", { name: "open-file-menu" });

    fireEvent.click(command);
    fireEvent.click(command);

    expect(command).toBeDisabled();
    expect(menuCommand).toBeDisabled();
    expect(mocks.dispatch).toHaveBeenCalledTimes(1);

    await act(async () => resolveCommand());
    await waitFor(() => expect(command).not.toBeDisabled());
    expect(menuCommand).not.toBeDisabled();
  });

  it("clears pending state and reports rejected commands without an unhandled rejection", async () => {
    mocks.dispatch.mockRejectedValueOnce(new Error("picker failed"));
    renderRuntime();
    const command = screen.getByRole("button", { name: "open-file" });

    fireEvent.click(command);

    await waitFor(() => {
      expect(command).not.toBeDisabled();
      expect(mocks.diagnosticsError).toHaveBeenCalledWith(
        "application.command.failed",
        expect.any(Error),
        expect.objectContaining({ data: { commandId: "open-file", surface: "palette" } }),
      );
    });
  });

  it("does not execute disabled commands", () => {
    state.importWorkflow.isNativeDialogOpen = true;
    renderRuntime();

    const command = screen.getByRole("button", { name: "open-file" });
    expect(command).toBeDisabled();
    fireEvent.click(command);
    expect(mocks.dispatch).not.toHaveBeenCalled();

    state.importWorkflow.isNativeDialogOpen = false;
  });
});

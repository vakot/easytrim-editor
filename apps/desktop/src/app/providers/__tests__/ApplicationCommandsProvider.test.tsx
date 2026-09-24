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
  availableVersion: null as string | null,
  updateStatus: "idle" as "idle" | "checking" | "available" | "up-to-date" | "error",
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
    theme: "system",
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
    availableVersion: mocks.availableVersion,
    checkForUpdates: vi.fn(),
    installUpdate: vi.fn(),
    isInstalling: false,
    status: mocks.updateStatus,
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
          data-group={command.group.label}
          data-has-icon={Boolean(command.icon)}
          data-keep-open={command.keepOpen}
          data-label={command.label}
          data-pending={command.pending}
          data-surfaces={command.surfaces?.join(",")}
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
    mocks.availableVersion = null;
    mocks.updateStatus = "idle";
    state.importWorkflow.isNativeDialogOpen = false;
  });

  it("executes synchronous commands through the shared runtime and exposes semantic metadata", async () => {
    mocks.dispatch.mockImplementation(() => undefined);
    renderRuntime();

    expect(
      screen.getAllByRole("button").filter((button) => button.hasAttribute("data-group")),
    ).toHaveLength(49);
    expect(
      screen
        .getAllByRole("button")
        .filter((button) => button.hasAttribute("data-group"))
        .every((button) => button.getAttribute("data-has-icon") === "true"),
    ).toBe(true);

    expect(screen.getByRole("button", { name: "delete-file" })).toHaveAttribute(
      "data-variant",
      "destructive",
    );
    for (const commandId of ["open-file", "open-folder", "close-file", "delete-file"]) {
      expect(screen.getByRole("button", { name: commandId })).toHaveAttribute("data-group", "File");
    }
    expect(screen.getByRole("button", { name: "theme-system" })).toHaveAttribute(
      "data-group",
      "Appearance / Theme",
    );
    expect(screen.getByRole("button", { name: "theme-system" })).toHaveAttribute(
      "data-checked",
      "true",
    );
    expect(screen.getByRole("button", { name: "language-en" })).toHaveAttribute(
      "data-label",
      "English",
    );
    expect(screen.getByRole("button", { name: "language-sk" })).toHaveAttribute(
      "data-label",
      "Slovenčina",
    );
    expect(screen.getByRole("button", { name: "language-ru" })).toHaveAttribute(
      "data-label",
      "Русский",
    );
    expect(screen.getByRole("button", { name: "primary-color-amber" })).toHaveAttribute(
      "data-group",
      "Appearance / Color",
    );
    expect(screen.getByRole("button", { name: "queue-finish-exit" })).toHaveAttribute(
      "data-group",
      "Queue / On finished / Application",
    );
    expect(screen.getByRole("button", { name: "delete-source-on-render-finish" })).toHaveAttribute(
      "data-group",
      "Queue / On finished / Source",
    );
    expect(screen.getByRole("button", { name: "toggle-left-panel" })).toHaveAttribute(
      "data-group",
      "Layout / Panels visibility",
    );
    expect(screen.getByRole("button", { name: "layout-density-default" })).toHaveAttribute(
      "data-group",
      "Layout / Density",
    );
    expect(screen.getByRole("button", { name: "activity-feed-view-default" })).toHaveAttribute(
      "data-group",
      "Layout / Activity Feed View",
    );
    expect(screen.getByRole("button", { name: "preference-auto-start-queue" })).toHaveAttribute(
      "data-group",
      "Preferences / Playback",
    );
    expect(screen.getByRole("button", { name: "preference-merge-audio" })).toHaveAttribute(
      "data-group",
      "Preferences / Audio",
    );
    expect(screen.getByRole("button", { name: "reset-preferences" })).toHaveAttribute(
      "data-group",
      "Preferences",
    );
    for (const commandId of ["reset-preferences", "reset-layout", "reset-transform"]) {
      expect(screen.getByRole("button", { name: commandId })).toHaveAttribute(
        "data-surfaces",
        "menu",
      );
    }
    expect(screen.getByRole("button", { name: "crop-preview" })).toHaveAttribute(
      "data-group",
      "Preview / Transform",
    );
    expect(screen.getByRole("button", { name: "reset-layout" })).toHaveAttribute(
      "data-variant",
      "destructive",
    );

    fireEvent.click(screen.getByRole("button", { name: "delete-file" }));

    expect(mocks.requestSourceDelete).toHaveBeenCalledWith({ sourceIds: ["source-1"] });
  });

  it("keeps update state label, variant, and icon synchronized in the owning command group", () => {
    const view = renderRuntime();
    const update = screen.getByRole("button", { name: "check-for-updates" });
    expect(update).toHaveAttribute("data-variant", "default");
    expect(update).toHaveAttribute("data-keep-open", "true");

    mocks.updateStatus = "up-to-date";
    view.rerender(
      <ApplicationCommandsProvider>
        <RuntimeProbe />
      </ApplicationCommandsProvider>,
    );

    expect(update).toHaveAttribute("data-variant", "success");
    expect(update.getAttribute("data-label")).toBeTruthy();
    expect(update).toHaveAttribute("data-has-icon", "true");
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

  it("does not execute menu-only commands from the palette surface", () => {
    renderRuntime();

    fireEvent.click(screen.getByRole("button", { name: "reset-preferences" }));

    expect(mocks.dispatch).not.toHaveBeenCalled();
  });
});

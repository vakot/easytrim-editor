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
  isPlaying: false,
  previewAvailable: false,
  openOptimizedExportDialog: vi.fn((origin: unknown) => ({
    origin,
    type: "export/optimized",
  })),
  requestSourceDelete: vi.fn(),
  resetPanels: vi.fn(),
  panelsAreReset: false,
  startFastCutRequested: vi.fn((origin: unknown) => ({
    origin,
    type: "export/fast",
  })),
}));

const state = {
  audio: { tracks: [] },
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
  editorTools: { loopPlaybackEnabled: true, segmentPlaybackEnabled: true },
  importWorkflow: { isChoosingSource: false, isNativeDialogOpen: false },
  preferences: {
    activityFeedView: "default",
    autoStartQueueEnabled: true,
    deleteSourceOnRenderFinish: false,
    layoutDensity: "default",
    loopPlaybackEnabledDefault: true,
    mergeAudioEnabledDefault: false,
    primaryColor: "#efbf04",
    segmentPlaybackEnabledDefault: true,
    theme: "system",
    uiScalePercent: 100,
  },
  export: { availableQueueFinishActions: ["exit", "nothing"], queueFinishAction: "nothing" },
  source: {
    media: {},
    source: { displayName: "source.mp4", sourcePath: "C:/source.mp4" },
    status: "ready",
  },
  trim: { value: null },
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
  usePreviewTransform: () => ({
    isAvailable: mocks.previewAvailable,
    requestCopyFrame: vi.fn(),
    requestCrop: vi.fn(),
    requestReset: vi.fn(),
    requestSaveFrame: vi.fn(),
  }),
}));
vi.mock("@/features/timeline", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/timeline")>()),
  useTimelineTransport: () => ({ isPlaying: mocks.isPlaying }),
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
    isReset: mocks.panelsAreReset,
    toggle: vi.fn(),
    reset: mocks.resetPanels,
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
import { useSettingsDialog } from "@/app/hooks/useSettingsDialog";
import { EditorRuntimeTestProvider } from "@/test/editor-runtime-test-provider";

import { ApplicationCommandsProvider } from "../ApplicationCommandsProvider";
import { SettingsDialogProvider } from "../SettingsDialogProvider";

function RuntimeProbe() {
  const { commands, executeCommand } = useApplicationCommands();
  const { isSettingsOpen } = useSettingsDialog();

  return (
    <div>
      {commands.map((command) => (
        <button
          aria-label={command.id}
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
          <span data-icon>{command.icon}</span>
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
      <button onClick={() => void executeCommand("reset-layout", "menu")} type="button">
        reset-layout-menu
      </button>
      <button onClick={() => void executeCommand("open-settings", "palette")} type="button">
        open-settings-palette
      </button>
      {isSettingsOpen ? <span data-testid="settings-open-from-command" /> : null}
    </div>
  );
}

function runtimeUi() {
  return (
    <EditorRuntimeTestProvider>
      <SettingsDialogProvider>
        <ApplicationCommandsProvider>
          <RuntimeProbe />
        </ApplicationCommandsProvider>
      </SettingsDialogProvider>
    </EditorRuntimeTestProvider>
  );
}

function renderRuntime() {
  return render(runtimeUi());
}

describe("ApplicationCommandsProvider", () => {
  beforeEach(() => {
    mocks.dispatch.mockReset();
    mocks.dispatch.mockImplementation(() => undefined);
    mocks.resetPanels.mockReset();
    mocks.panelsAreReset = false;
    mocks.diagnosticsError.mockClear();
    mocks.requestSourceDelete.mockClear();
    mocks.availableVersion = null;
    mocks.updateStatus = "idle";
    mocks.isPlaying = false;
    mocks.previewAvailable = false;
    state.importWorkflow.isNativeDialogOpen = false;
    state.preferences.activityFeedView = "default";
    state.preferences.layoutDensity = "default";
    state.preferences.autoStartQueueEnabled = true;
    state.preferences.uiScalePercent = 100;
    state.preferences.loopPlaybackEnabledDefault = true;
    state.preferences.mergeAudioEnabledDefault = false;
    state.preferences.segmentPlaybackEnabledDefault = true;
  });

  it("executes synchronous commands through the shared runtime and exposes semantic metadata", async () => {
    mocks.dispatch.mockImplementation(() => undefined);
    renderRuntime();

    expect(
      screen.getAllByRole("button").filter((button) => button.hasAttribute("data-group")),
    ).toHaveLength(61);
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
    for (const commandId of [
      "flip-horizontal",
      "flip-vertical",
      "rotate-180",
      "rotate-90-ccw",
      "rotate-90-cw",
    ]) {
      expect(screen.getByRole("button", { name: commandId })).not.toHaveAttribute("data-checked");
    }
    expect(
      screen.getByRole("button", { name: "reset-appearance-theme-color-settings" }),
    ).toHaveAttribute(
      "data-group",
      "Appearance / Theme",
    );
    expect(screen.getByRole("button", { name: "reset-queue-settings" })).toHaveAttribute(
      "data-group",
      "Queue",
    );
    for (const commandId of ["language-en", "language-sk", "language-ru"]) {
      expect(screen.queryByRole("button", { name: commandId })).not.toBeInTheDocument();
    }
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
      "Queue",
    );
    expect(screen.getByRole("button", { name: "preference-merge-audio" })).toHaveAttribute(
      "data-group",
      "Preferences / Audio",
    );
    expect(screen.getByRole("button", { name: "reset-editor-settings" })).toHaveAttribute(
      "data-group",
      "Preferences",
    );
    for (const commandId of [
      "reset-editor-settings",
      "reset-layout",
      "reset-queue-settings",
      "reset-appearance-theme-color-settings",
    ]) {
      expect(screen.getByRole("button", { name: commandId })).toHaveAttribute(
        "data-surfaces",
        "dialog,menu",
      );
    }
    expect(screen.getByRole("button", { name: "reset-transform" })).toHaveAttribute(
      "data-surfaces",
      "menu",
    );
    expect(screen.getByRole("button", { name: "crop-preview" })).toHaveAttribute(
      "data-group",
      "Preview / Transform",
    );
    for (const commandId of ["save-current-frame", "copy-current-frame"]) {
      expect(screen.getByRole("button", { name: commandId })).toHaveAttribute(
        "data-group",
        "Preview / Frame",
      );
      expect(screen.getByRole("button", { name: commandId })).toHaveAttribute(
        "data-surfaces",
        "menu,palette",
      );
    }
    expect(screen.getByRole("button", { name: "reset-layout" })).toHaveAttribute(
      "data-variant",
      "destructive",
    );
    expect(screen.getByRole("button", { name: "reset-layout" })).toHaveAttribute(
      "data-label",
      "Reset to default",
    );
    for (const commandId of [
      "reset-appearance-settings",
      "reset-editor-settings",
      "reset-appearance-theme-color-settings",
      "reset-queue-settings",
    ]) {
      expect(screen.getByRole("button", { name: commandId })).toHaveAttribute(
        "data-label",
        "Reset to default",
      );
    }
    expect(screen.getByRole("button", { name: "reset-appearance-settings" })).toHaveAttribute(
      "data-surfaces",
      "dialog",
    );

    fireEvent.click(screen.getByRole("button", { name: "delete-file" }));

    expect(mocks.requestSourceDelete).toHaveBeenCalledWith({ sourceIds: ["source-1"] });
  });

  it("opens Settings through the application command", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
    renderRuntime();

    await user.click(screen.getByRole("button", { name: "open-settings-palette" }));

    expect(screen.getByTestId("settings-open-from-command")).toBeInTheDocument();
  });

  it("allows saving a frame only while playback is paused", () => {
    mocks.previewAvailable = true;
    mocks.isPlaying = true;
    const view = renderRuntime();

    expect(screen.getByRole("button", { name: "save-current-frame" })).toBeDisabled();

    mocks.isPlaying = false;
    view.rerender(runtimeUi());

    expect(screen.getByRole("button", { name: "save-current-frame" })).toBeEnabled();
  });

  it("keeps update state label, variant, and icon synchronized in the owning command group", () => {
    const view = renderRuntime();
    const update = screen.getByRole("button", { name: "check-for-updates" });
    expect(update).toHaveAttribute("data-variant", "default");
    expect(update).toHaveAttribute("data-keep-open", "true");

    mocks.updateStatus = "up-to-date";
    view.rerender(runtimeUi());

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

    fireEvent.click(screen.getByRole("button", { name: "reset-editor-settings" }));

    expect(mocks.dispatch).not.toHaveBeenCalled();
  });

  it("resets layout preferences and panels from the menu surface", () => {
    renderRuntime();

    fireEvent.click(screen.getByRole("button", { name: "reset-layout-menu" }));

    expect(mocks.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: "preferences/layoutReset" }),
    );
    expect(mocks.resetPanels).toHaveBeenCalledOnce();
  });

  it("enables layout reset when density or activity-feed view differs from its default", () => {
    state.preferences.layoutDensity = "compact";
    state.preferences.activityFeedView = "branch";
    mocks.panelsAreReset = true;
    renderRuntime();

    expect(screen.getByRole("button", { name: "reset-layout" })).toBeEnabled();
  });

  it("enables only the reset command that owns a changed setting", () => {
    state.preferences.autoStartQueueEnabled = false;
    state.preferences.uiScalePercent = 125;
    renderRuntime();

    expect(screen.getByRole("button", { name: "reset-queue-settings" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "reset-appearance-settings" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "reset-editor-settings" })).toBeDisabled();
  });
});

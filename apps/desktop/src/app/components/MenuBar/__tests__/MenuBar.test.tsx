import {
  fireEvent,
  render as renderWithTestingLibrary,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ReactElement, useRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { ResizablePanelContextProvider } from "@/components/ui/resizable";
import { TooltipProvider } from "@/components/ui/tooltip";

import { CommandPalette } from "@/app/components/CommandPalette";
import { SettingsDialog } from "@/app/components/SettingsDialog";
import { AppUpdatesContext } from "@/app/contexts/app-updates-context";
import { useSettingsDialog } from "@/app/hooks/useSettingsDialog";
import { DEFAULT_PREFERENCES, type PreferenceKey, type Preferences } from "@/app/preferences";
import { ApplicationCommandsProvider } from "@/app/providers/ApplicationCommandsProvider";
import { CommandPaletteProvider } from "@/app/providers/CommandPaletteProvider";
import { SettingsDialogProvider } from "@/app/providers/SettingsDialogProvider";
import { ThemeProvider } from "@/app/theme/ThemeProvider";
import type { SourceRef } from "@/domain/source";
import { ChangelogProvider } from "@/features/changelog";
import { ExportActions, QueueDeleteSourceProvider } from "@/features/export";
import { PreviewTransformProvider } from "@/features/preview";
import { SourceDeleteProvider } from "@/features/source";
import { i18n } from "@/i18n/config";
import { getCurrentVersion } from "@/lib/app-version.utils";
import { openExternalUrl } from "@/lib/open-external-url.utils";
import type { QueueFinishAction } from "@/lib/tauri/queue.types";
import { EditorRuntimeTestProvider } from "@/test/editor-runtime-test-provider";

import { MenuBar as AppMenuBar } from "../MenuBar";

const menuState = vi.hoisted(() => ({
  dispatch: vi.fn(),
  importWorkflow: {
    isChoosingSource: false,
  },
  source: {
    isReady: true,
    selection: null as SourceRef | null,
    media: null as Record<string, never> | null,
  },
  crop: {
    value: { x: 0, y: 0, width: 1, height: 1 },
  },
  export: {
    queue: [] as Array<{ status: "queued" | "rendering" }>,
    queueDialogOpen: false,
    queueStarted: false,
    queueFinishAction: "nothing" as QueueFinishAction,
    availableQueueFinishActions: ["exit", "nothing"] as QueueFinishAction[],
  },
  preferences: {
    activityFeedView: "default",
    layoutDensity: "default",
    loopPlaybackEnabledDefault: true,
    segmentPlaybackEnabledDefault: true,
    autoStartQueueEnabled: true,
    deleteSourceOnRenderFinish: false,
    lastSeenChangelogVersion: "1.10.4",
    mergeAudioEnabledDefault: false,
    theme: "system",
    primaryColor: "#efbf04",
    lastAudiblePlaybackVolumePercent: 100,
    playbackVolumePercent: 100,
    uiScalePercent: 100,
  } as Preferences,
}));

const defaultAppUpdates = {
  status: "idle" as const,
  availableVersion: null,
  isInstalling: false,
  checkForUpdates: vi.fn(async () => undefined),
  installUpdate: vi.fn(async () => undefined),
};

const nativeDiagnostics = vi.hoisted(() => ({
  persistDiagnosticEvent: vi.fn(async () => undefined),
  revealDiagnosticLogs: vi.fn(),
}));

const nativeWindow = vi.hoisted(() => ({ requestWindowShutdown: vi.fn() }));

function render(ui: ReactElement) {
  return renderWithTestingLibrary(
    <AppUpdatesContext.Provider value={defaultAppUpdates}>{ui}</AppUpdatesContext.Provider>,
  );
}

function getMenuTrigger(name: string) {
  if (name === "Settings") return screen.getByRole("button", { name });
  return within(screen.getByRole("menubar", { name: "Application menus" })).getByRole("menuitem", {
    name,
  });
}

function SettingsOpenIndicator() {
  const { isSettingsOpen } = useSettingsDialog();
  return isSettingsOpen ? <span data-testid="settings-open" /> : null;
}

vi.mock("@/app/store/redux-hooks", () => ({
  useAppDispatch: () => menuState.dispatch,
  useAppStore: () => ({
    getState: () => ({ editingInstances: { ids: [], entities: {} } }),
    subscribe: () => () => {},
  }),
  useAppSelector: (selector: (state: unknown) => unknown) =>
    selector({
      audio: { tracks: [] },
      preferences: menuState.preferences,
      importWorkflow: menuState.importWorkflow,
      source: {
        status: menuState.source.selection && menuState.source.isReady ? "ready" : "idle",
        source: menuState.source.selection,
        media: menuState.source.media,
        error: null,
        capabilities: { status: "checking" },
      },
      crop: menuState.crop,
      editorTools: { loopPlaybackEnabled: true, segmentPlaybackEnabled: true },
      trim: { value: null },
      export: {
        queue: menuState.export.queue,
        exportQueueDialogOpen: menuState.export.queueDialogOpen,
        startedSourceIds: menuState.export.queueStarted
          ? menuState.export.queue.map((_, index) => `instance-${index}`)
          : [],
        queueFinishAction: menuState.export.queueFinishAction,
        availableQueueFinishActions: menuState.export.availableQueueFinishActions,
        optimizedDialogOpen: false,
        optimizedSettings: null,
        optimizedPlanRequestId: null,
        commandPreview: "",
        commandPreviewError: null,
        launchError: null,
      },
      editingInstances: {
        ids: [
          ...menuState.export.queue.map((_, index) => `instance-${index}`),
          ...(menuState.source.selection ? ["source"] : []),
        ],
        entities: {
          ...Object.fromEntries(
            menuState.export.queue.map((item, index) => [
              `instance-${index}`,
              {
                id: `instance-${index}`,
                exportAttempts: [{ id: `attempt-${index}`, state: { status: item.status } }],
              },
            ]),
          ),
          ...(menuState.source.selection
            ? {
                source: {
                  id: "source",
                  exportAttempts: [],
                  snapshot: { source: menuState.source.selection },
                  sourceAvailability: "available",
                },
              }
            : {}),
        },
        activeInstanceId: menuState.source.selection ? "source" : null,
      },
    }),
}));

vi.mock("@/lib/open-external-url.utils", () => ({
  openExternalUrl: vi.fn(),
}));
vi.mock("@/lib/tauri/diagnostics", () => nativeDiagnostics);
vi.mock("@/lib/tauri/window", () => nativeWindow);

describe("MenuBarTest", () => {
  const currentVersion = getCurrentVersion();
  const versionMenuLabel = `Version ${currentVersion}`;

  type MenuTestOverrides = {
    availableQueueFinishActions?: QueueFinishAction[];
    canExport?: boolean;
    canSave?: boolean;
    hasActiveItem?: boolean;
    hasQueuedItems?: boolean;
    hasSource?: boolean;
    isChoosingSource?: boolean;
    onPreferenceChange?: (key: PreferenceKey, enabled: boolean) => void;
    preferences?: Preferences;
    primaryColor?: Preferences["primaryColor"];
    queueFinishAction?: QueueFinishAction;
    queueStarted?: boolean;
    themePreference?: Preferences["theme"];
  };

  function configureMenuState(overrides: MenuTestOverrides = {}, notify: () => void = () => {}) {
    menuState.importWorkflow.isChoosingSource = overrides.isChoosingSource ?? false;
    menuState.source.selection = overrides.hasSource
      ? { displayName: "source.mp4", sourcePath: "C:/Media/source.mp4" }
      : null;
    menuState.source.isReady = overrides.canExport ?? true;
    menuState.source.media = menuState.source.selection && menuState.source.isReady ? {} : null;
    menuState.crop.value =
      overrides.canSave === false
        ? { x: 0.1, y: 0, width: 0.9, height: 1 }
        : { x: 0, y: 0, width: 1, height: 1 };
    menuState.export.queue = [
      ...(overrides.hasQueuedItems ? [{ status: "queued" as const }] : []),
      ...(overrides.hasActiveItem ? [{ status: "rendering" as const }] : []),
    ];
    menuState.export.queueDialogOpen = false;
    menuState.export.queueStarted = overrides.queueStarted ?? false;
    menuState.export.queueFinishAction = overrides.queueFinishAction ?? "nothing";
    menuState.export.availableQueueFinishActions = overrides.availableQueueFinishActions ?? [
      "exit",
      "nothing",
    ];
    menuState.preferences = overrides.preferences ?? {
      ...DEFAULT_PREFERENCES,
      lastSeenChangelogVersion: getCurrentVersion(),
    };
    menuState.preferences.theme = overrides.themePreference ?? "system";
    menuState.preferences.primaryColor = overrides.primaryColor ?? "#efbf04";
    const setPreference =
      overrides.onPreferenceChange ??
      ((key: PreferenceKey, enabled: boolean) => {
        menuState.preferences[key] = enabled;
      });

    menuState.dispatch = vi.fn((action: { payload?: unknown; type: string }) => {
      if (action.type === "export/exportQueueDialogOpened") {
        menuState.export.queueDialogOpen = true;
      }
      if (action.type === "export/exportQueueDialogClosed") {
        menuState.export.queueDialogOpen = false;
      }
      if (
        action.type === "preferences/preferenceChanged" &&
        typeof action.payload === "object" &&
        action.payload !== null &&
        "key" in action.payload &&
        "enabled" in action.payload
      ) {
        const payload = action.payload as { enabled: boolean; key: PreferenceKey };
        setPreference(payload.key, payload.enabled);
      }
      if (action.type === "preferences/editingSettingsReset") {
        menuState.preferences.loopPlaybackEnabledDefault =
          DEFAULT_PREFERENCES.loopPlaybackEnabledDefault;
        menuState.preferences.mergeAudioEnabledDefault =
          DEFAULT_PREFERENCES.mergeAudioEnabledDefault;
        menuState.preferences.segmentPlaybackEnabledDefault =
          DEFAULT_PREFERENCES.segmentPlaybackEnabledDefault;
      }
      if (action.type === "queue/settingsReset") {
        menuState.export.queueFinishAction = "nothing";
        menuState.preferences.autoStartQueueEnabled = DEFAULT_PREFERENCES.autoStartQueueEnabled;
        menuState.preferences.deleteSourceOnRenderFinish = false;
      }
      if (action.type === "preferences/themePreferenceChanged") {
        menuState.preferences.theme = action.payload as Preferences["theme"];
      }
      if (action.type === "preferences/uiScaleIncreased") {
        menuState.preferences.uiScalePercent = Math.min(
          200,
          menuState.preferences.uiScalePercent + 25,
        );
      }
      if (action.type === "preferences/uiScaleDecreased") {
        menuState.preferences.uiScalePercent = Math.max(
          50,
          menuState.preferences.uiScalePercent - 25,
        );
      }
      if (action.type === "preferences/primaryColorChanged") {
        menuState.preferences.primaryColor = action.payload as Preferences["primaryColor"];
      }
      notify();
    });
  }

  function MenuBarTest(overrides: MenuTestOverrides = {}) {
    const [, forceUpdate] = useState(0);
    const initialized = useRef<boolean | null>(null);
    if (initialized.current === null) {
      configureMenuState(overrides, () => forceUpdate((value) => value + 1));
      initialized.current = true;
    }
    return (
      <EditorRuntimeTestProvider>
        <SourceDeleteProvider>
          <QueueDeleteSourceProvider>
            <PreviewTransformProvider>
              <ChangelogProvider>
                <ResizablePanelContextProvider>
                  <CommandPaletteProvider>
                    <SettingsDialogProvider>
                      <ApplicationCommandsProvider>
                        <ThemeProvider>
                          <AppMenuBar />
                          <CommandPalette />
                          <ExportActions />
                          <SettingsDialog />
                          <SettingsOpenIndicator />
                        </ThemeProvider>
                      </ApplicationCommandsProvider>
                    </SettingsDialogProvider>
                  </CommandPaletteProvider>
                </ResizablePanelContextProvider>
              </ChangelogProvider>
            </PreviewTransformProvider>
          </QueueDeleteSourceProvider>
        </SourceDeleteProvider>
      </EditorRuntimeTestProvider>
    );
  }

  function renderMenus(overrides: MenuTestOverrides = {}) {
    return render(
      <TooltipProvider>
        <AppUpdatesContext.Provider
          value={{
            status: "idle",
            availableVersion: null,
            isInstalling: false,
            checkForUpdates: vi.fn(),
            installUpdate: vi.fn(),
          }}
        >
          <MenuBarTest {...overrides} />
        </AppUpdatesContext.Provider>
      </TooltipProvider>,
    );
  }

  it("keeps the top-level menus in their expected order", () => {
    renderMenus();
    const menuButtons = screen
      .getByRole("menubar", { name: "Application menus" })
      .querySelectorAll("button");

    const labels = [...menuButtons].map((button) => button.textContent);
    expect(labels).toEqual(["File", "View", "Settings", "Help"]);
  });

  it("opens the Command Palette from View", async () => {
    const user = userEvent.setup();
    renderMenus();

    await user.click(getMenuTrigger("View"));
    await user.click(screen.getByRole("menuitem", { name: /Command Palette/ }));

    expect(await screen.findByRole("combobox", { name: "Search commands" })).toBeVisible();
  });

  it("opens the Export Queue from View", async () => {
    const user = userEvent.setup();
    renderMenus();

    await user.click(getMenuTrigger("View"));
    await user.click(screen.getByRole("menuitem", { name: /Export Queue/ }));

    expect(await screen.findByRole("dialog", { name: "Export Queue" })).toBeVisible();
  });

  it("keeps queue configuration in Preferences, separate from queue actions", async () => {
    const user = userEvent.setup();
    renderMenus({ hasQueuedItems: true, hasActiveItem: true });

    await user.click(getMenuTrigger("Settings"));
    await user.click(screen.getByRole("tab", { name: "Preferences" }));
    expect(screen.queryByRole("tab", { name: "Queue" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reset editing settings" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reset queue settings" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /Start queue/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Skip" })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Cancel" })).not.toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Delete source" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "On queue finished" })).toBeInTheDocument();
  });

  it("keeps UI scaling reset local to Appearance", async () => {
    const user = userEvent.setup();
    renderMenus({ themePreference: "dark", primaryColor: "#4299e1" });

    await user.click(getMenuTrigger("Settings"));
    await user.click(screen.getByRole("tab", { name: "Appearance" }));
    expect(screen.queryByRole("button", { name: "Reset to default" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reset" })).toBeInTheDocument();
  });

  it("resets queue finish and delete-source settings from Settings", async () => {
    const user = userEvent.setup();
    renderMenus({
      queueFinishAction: "exit",
      preferences: { ...DEFAULT_PREFERENCES, deleteSourceOnRenderFinish: true },
    });

    await user.click(getMenuTrigger("Settings"));
    await user.click(screen.getByRole("tab", { name: "Preferences" }));
    await user.click(screen.getByRole("button", { name: "Reset queue settings" }));

    expect(menuState.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: "queue/settingsReset" }),
    );
    expect(menuState.export.queueFinishAction).toBe("nothing");
    expect(menuState.preferences.deleteSourceOnRenderFinish).toBe(false);
  });

  it("selects an available queue finish action", async () => {
    const user = userEvent.setup();
    renderMenus({
      availableQueueFinishActions: ["exit", "nothing"],
    });

    await user.click(getMenuTrigger("Settings"));
    await user.click(screen.getByRole("tab", { name: "Preferences" }));
    await user.click(screen.getByRole("combobox", { name: "On queue finished" }));
    await user.click(screen.getByRole("option", { name: "Exit application" }));
    expect(menuState.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: "export/queueFinishActionChanged", payload: "exit" }),
    );
  });

  it("requires confirmation before enabling source deletion after render", async () => {
    const user = userEvent.setup();
    renderMenus();

    await user.click(getMenuTrigger("Settings"));
    await user.click(screen.getByRole("tab", { name: "Preferences" }));
    const deleteSourceItem = screen.getByRole("switch", { name: "Delete source" });
    expect(deleteSourceItem).not.toBeChecked();

    await user.click(deleteSourceItem);
    expect(
      screen.getByRole("heading", { name: "Delete source after export?" }),
    ).toBeInTheDocument();
    expect(menuState.dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({
        type: "preferences/preferenceChanged",
        payload: { enabled: false, key: "deleteSourceOnRenderFinish" },
      }),
    );

    await user.click(screen.getByRole("button", { name: "Enable" }));
    expect(menuState.dispatch).toHaveBeenCalledWith({
      type: "preferences/preferenceChanged",
      payload: { enabled: true, key: "deleteSourceOnRenderFinish" },
    });
  });

  it("disables source deletion without confirmation", async () => {
    const user = userEvent.setup();
    renderMenus({
      preferences: { ...DEFAULT_PREFERENCES, deleteSourceOnRenderFinish: true },
    });

    await user.click(getMenuTrigger("Settings"));
    await user.click(screen.getByRole("tab", { name: "Preferences" }));
    const deleteSourceItem = screen.getByRole("switch", { name: "Delete source" });
    expect(deleteSourceItem).toBeChecked();

    await user.click(deleteSourceItem);

    expect(menuState.dispatch).toHaveBeenCalledWith({
      type: "preferences/preferenceChanged",
      payload: { enabled: false, key: "deleteSourceOnRenderFinish" },
    });
    expect(screen.getByRole("switch", { name: "Delete source" })).not.toBeChecked();
    expect(
      screen.queryByRole("heading", { name: "Delete source after export?" }),
    ).not.toBeInTheDocument();
  });

  it("opens Help links with the current release version", async () => {
    const user = userEvent.setup();
    render(
      <TooltipProvider>
        <ThemeProvider>
          <MenuBarTest canExport canSave isChoosingSource={false} />
        </ThemeProvider>
      </TooltipProvider>,
    );

    await user.click(getMenuTrigger("Help"));
    expect(screen.getByRole("menuitem", { name: "Changelog" })).toHaveTextContent("Changelog");
    expect(screen.getByRole("menuitem", { name: "Check for Updates…" })).toHaveTextContent(
      "Check for Updates…",
    );
    expect(screen.getByRole("menuitem", { name: "Support the Project" })).toHaveTextContent(
      "Support the Project",
    );
    expect(screen.getByRole("menuitem", { name: "Show logs" })).toHaveTextContent("Show logs");
    expect(screen.getByRole("menuitem", { name: versionMenuLabel })).toHaveTextContent(
      currentVersion,
    );
    expect(screen.getAllByRole("separator")).toHaveLength(3);

    await user.click(screen.getByRole("menuitem", { name: "Check for Updates…" }));
    expect(screen.getByRole("menuitem", { name: "Check for Updates…" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Project Page" })).toHaveTextContent(
      "Project Page",
    );
    expect(
      screen
        .getByRole("menuitem", { name: "Project Page" })
        .querySelector('[data-brand-icon="github"]'),
    ).not.toBeNull();
    expect(
      screen
        .getByRole("menuitem", { name: "Support the Project" })
        .querySelector('[data-brand-icon="kofi"]'),
    ).not.toBeNull();
    expect(
      screen.getByRole("menuitem", { name: "Project Page" }).querySelector(".lucide-external-link"),
    ).toBeNull();
    expect(
      screen
        .getByRole("menuitem", { name: "Support the Project" })
        .querySelector(".lucide-external-link"),
    ).toBeNull();

    await user.click(screen.getByRole("menuitem", { name: "Show logs" }));
    expect(nativeDiagnostics.revealDiagnosticLogs).toHaveBeenCalledOnce();
    await user.click(getMenuTrigger("Help"));
    await user.click(screen.getByRole("menuitem", { name: "Changelog" }));
    expect(screen.getByRole("heading", { name: "Changelog" })).toBeInTheDocument();
    await user.click(
      screen.getByRole("dialog").querySelector("button[data-variant='default']") as HTMLElement,
    );
    await user.click(getMenuTrigger("Help"));
    await user.click(screen.getByRole("menuitem", { name: "Project Page" }));
    await user.click(getMenuTrigger("Help"));
    await user.click(screen.getByRole("menuitem", { name: "Support the Project" }));
    await user.click(getMenuTrigger("Help"));
    await user.click(screen.getByRole("menuitem", { name: versionMenuLabel }));

    expect(vi.mocked(openExternalUrl).mock.calls).toEqual([
      ["https://github.com/vakot/easytrim-editor"],
      ["https://ko-fi.com/vakot"],
      [`https://github.com/vakot/easytrim-editor/releases/tag/v${currentVersion}`],
    ]);
  });

  it("shows visible feedback when no update is available", async () => {
    const user = userEvent.setup();
    render(
      <TooltipProvider>
        <ThemeProvider>
          <AppUpdatesContext.Provider
            value={{
              status: "up-to-date",
              availableVersion: null,
              isInstalling: false,
              checkForUpdates: vi.fn(),
              installUpdate: vi.fn(),
            }}
          >
            <MenuBarTest canExport canSave isChoosingSource={false} />
          </AppUpdatesContext.Provider>
        </ThemeProvider>
      </TooltipProvider>,
    );

    await user.click(getMenuTrigger("Help"));
    const updateItem = screen.getByRole("menuitem", { name: "Up to Date" });
    expect(updateItem).toBeInTheDocument();
    expect(updateItem.querySelector("svg")).not.toBeNull();
  });

  it("routes an available update through the shutdown confirmation", async () => {
    const user = userEvent.setup();
    const installUpdate = vi.fn(async () => undefined);
    renderWithTestingLibrary(
      <TooltipProvider>
        <ThemeProvider>
          <AppUpdatesContext.Provider
            value={{
              status: "available",
              availableVersion: "2.0.0",
              isInstalling: false,
              checkForUpdates: vi.fn(),
              installUpdate,
            }}
          >
            <MenuBarTest canExport canSave isChoosingSource={false} />
          </AppUpdatesContext.Provider>
        </ThemeProvider>
      </TooltipProvider>,
    );

    await user.click(getMenuTrigger("Help"));
    await user.click(screen.getByRole("menuitem", { name: "Update" }));

    expect(nativeWindow.requestWindowShutdown).toHaveBeenCalledWith(installUpdate);
    expect(installUpdate).not.toHaveBeenCalled();
  });

  it("opens Settings from the regular menubar button", async () => {
    const user = userEvent.setup();
    renderMenus();
    await user.click(getMenuTrigger("Settings"));
    expect(screen.getByTestId("settings-open")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("opens Settings from the compact menu", async () => {
    const user = userEvent.setup();
    render(
      <TooltipProvider>
        <AppUpdatesContext.Provider value={defaultAppUpdates}>
          <MenuBarTest />
        </AppUpdatesContext.Provider>
      </TooltipProvider>,
    );
    await user.click(screen.getAllByLabelText("Application menus").at(-1)!);
    await user.click(screen.getByRole("menuitem", { name: "Settings" }));
    expect(screen.getByTestId("settings-open")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("switches settings pages and applies default changes immediately", async () => {
    const user = userEvent.setup();
    renderMenus();
    await user.click(getMenuTrigger("Settings"));

    const preferencesTab = screen.getByRole("tab", { name: "Preferences" });
    expect(screen.getByRole("tab", { name: "General" })).toHaveAttribute("aria-selected", "true");
    await user.click(preferencesTab);
    expect(preferencesTab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Editing")).toBeInTheDocument();
    expect(screen.getByText("Reset editing settings")).toBeInTheDocument();

    const loopSwitch = screen.getByRole("switch", { name: "Loop" });
    expect(loopSwitch).toBeChecked();
    await user.click(loopSwitch);
    expect(menuState.preferences.loopPlaybackEnabledDefault).toBe(false);
    expect(loopSwitch).not.toBeChecked();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows the saved UI scale and changes it through the zoom commands", async () => {
    const user = userEvent.setup();
    renderMenus({
      preferences: { ...DEFAULT_PREFERENCES, uiScalePercent: 150 },
    });
    await user.click(getMenuTrigger("Settings"));
    await user.click(screen.getByRole("tab", { name: "Appearance" }));

    const scaleSelect = screen.getByRole("combobox", { name: "UI Scaling" });
    expect(scaleSelect).toHaveTextContent("150%");
    expect(screen.getAllByRole("button", { name: "Primary accent" })).toHaveLength(1);
    expect(screen.queryByText("Update channel")).not.toBeInTheDocument();

    await user.click(scaleSelect);
    await user.click(screen.getByRole("option", { name: "200%" }));

    await waitFor(() => expect(menuState.preferences.uiScalePercent).toBe(200));
    expect(scaleSelect).toHaveTextContent("200%");
  });

  it("routes picker presets through the color session and previews spectrum edits", async () => {
    const user = userEvent.setup();
    renderMenus({ primaryColor: "#4299e1" });
    await user.click(getMenuTrigger("Settings"));
    await user.click(screen.getByRole("tab", { name: "Appearance" }));
    await user.click(screen.getByRole("button", { name: "Primary accent" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Primary color HEX" }), {
      target: { value: "efbf04" },
    });

    const colorInput = screen.getByRole("textbox", { name: "Primary color HEX" });
    expect(colorInput).not.toHaveClass("flex-1");
    expect(colorInput.parentElement?.parentElement).toHaveClass("flex-1");

    expect(menuState.preferences.primaryColor).toBe("#efbf04");
    expect(document.documentElement).not.toHaveAttribute("data-primary-color-scrubbing");
    expect(document.documentElement.style.getPropertyValue("--primary-color-preview")).toBe("");
    expect(screen.getByRole("button", { name: "Amber" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("textbox", { name: "Primary color HEX" })).toHaveValue("efbf04");
    const spectrum = screen.getByRole("button", {
      name: "Saturation and brightness",
    });

    const spectrumMarker = spectrum.querySelector<HTMLElement>(
      '[data-slot="color-spectrum-marker"]',
    );

    const hueMarker = screen
      .getByRole("slider", { name: "Hue" })
      .querySelector<HTMLElement>('[data-slot="color-hue-marker"]');

    expect(spectrumMarker?.style.left).not.toBe("0%");
    expect(hueMarker?.style.left).not.toBe("0%");

    Object.defineProperty(spectrum, "getBoundingClientRect", {
      value: () => new DOMRect(0, 0, 192, 192),
    });
    Object.assign(spectrum, {
      hasPointerCapture: () => true,
      releasePointerCapture: vi.fn(),
      setPointerCapture: vi.fn(),
    });

    fireEvent.pointerDown(spectrum, { clientX: 96, clientY: 96, pointerId: 1 });

    expect(menuState.preferences.primaryColor).toBe("#efbf04");
    expect(document.documentElement.style.getPropertyValue("--primary-color-preview")).toBe(
      "#807240",
    );
    fireEvent.pointerCancel(spectrum, { pointerId: 1 });
    expect(document.documentElement.style.getPropertyValue("--primary-color-preview")).toBe("");
    expect(menuState.preferences.primaryColor).toBe("#efbf04");
  });

  it("keeps the picker session and exact hue when a hue-360 commit updates preferences", async () => {
    const user = userEvent.setup();
    renderMenus({ primaryColor: "#4299e1" });
    await user.click(getMenuTrigger("Settings"));
    await user.click(screen.getByRole("tab", { name: "Appearance" }));
    await user.click(screen.getByRole("button", { name: "Primary accent" }));

    const hue = screen.getByRole("slider", { name: "Hue" });
    const hueMarker = hue.querySelector<HTMLElement>('[data-slot="color-hue-marker"]');
    Object.defineProperty(hue, "getBoundingClientRect", {
      value: () => new DOMRect(0, 0, 200, 16),
    });
    Object.assign(hue, {
      hasPointerCapture: () => true,
      releasePointerCapture: vi.fn(),
      setPointerCapture: vi.fn(),
    });

    fireEvent.pointerDown(hue, { button: 0, clientX: 200, clientY: 8, pointerId: 1 });
    fireEvent.pointerUp(hue, { button: 0, clientX: 200, clientY: 8, pointerId: 1 });

    const committedHue = screen.getByRole("slider", { name: "Hue" });
    expect(menuState.preferences.primaryColor).not.toBe("#4299e1");
    expect(committedHue).toBe(hue);
    expect(committedHue).toHaveAttribute("aria-valuenow", "360");
    expect(committedHue.querySelector('[data-slot="color-hue-marker"]')).toBe(hueMarker);
    expect(hueMarker?.style.left).toBe("100%");
  });

  it("uses localized names for the composed color controls", async () => {
    const user = userEvent.setup();
    await i18n.changeLanguage("ru");
    renderMenus();
    await user.click(screen.getByRole("button", { name: "Настройки" }));
    await user.click(screen.getByRole("tab", { name: "Внешний вид" }));
    await user.click(screen.getByRole("button", { name: "Основной цвет" }));

    expect(screen.getByRole("button", { name: "Насыщенность и яркость" })).toBeVisible();
    expect(screen.getByRole("slider", { name: "Оттенок" })).toBeVisible();

    await i18n.changeLanguage("en");
  });

  it("changes the interface language through the existing i18n path", async () => {
    const user = userEvent.setup();
    renderMenus();
    await user.click(getMenuTrigger("Settings"));

    await user.click(screen.getByLabelText("Language"));
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(2);
    expect(options.map((option) => option.getAttribute("aria-label"))).toEqual(
      expect.arrayContaining(["English, en", "Русский, ru"]),
    );
    expect(screen.queryByRole("option", { name: /Japanese/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole("option", { name: /, ru$/ }));
    await waitFor(() => expect(i18n.resolvedLanguage).toBe("ru"));
    await i18n.changeLanguage("en");
  });

  it("shows retry feedback after an update check fails", async () => {
    const user = userEvent.setup();
    render(
      <TooltipProvider>
        <ThemeProvider>
          <AppUpdatesContext.Provider
            value={{
              status: "error",
              availableVersion: null,
              isInstalling: false,
              checkForUpdates: vi.fn(),
              installUpdate: vi.fn(),
            }}
          >
            <MenuBarTest canExport canSave isChoosingSource={false} />
          </AppUpdatesContext.Provider>
        </ThemeProvider>
      </TooltipProvider>,
    );

    await user.click(getMenuTrigger("Help"));
    const updateItem = screen.getByRole("menuitem", { name: "Check for Updates…" });
    expect(updateItem).toBeInTheDocument();
    expect(updateItem.querySelector("svg")).not.toBeNull();
  });

  it("opens the File menu with its action and hotkey hint", async () => {
    const user = userEvent.setup();
    render(
      <TooltipProvider>
        <ThemeProvider>
          <MenuBarTest canExport canSave hasSource isChoosingSource={false} />
        </ThemeProvider>
      </TooltipProvider>,
    );

    const fileButton = getMenuTrigger("File");
    expect(fileButton).toHaveAttribute("data-slot", "menubar-trigger");
    expect(fileButton).toHaveAttribute("data-size", "sm");
    expect(fileButton).toHaveClass("h-7");

    await user.click(fileButton);
    expect(screen.getAllByRole("separator")).toHaveLength(2);

    const openFileItem = screen.getByRole("menuitem", { name: /Open File/ });
    expect(openFileItem).toHaveTextContent("CtrlO");
    expect(openFileItem).toHaveClass("min-w-48");
    await user.click(openFileItem);
    expect(screen.queryByRole("menuitem", { name: /Open File/ })).not.toBeInTheDocument();

    await user.click(fileButton);
    const openFolderItem = screen.getByRole("menuitem", { name: /Open Folder/ });
    expect(openFolderItem).toHaveTextContent("CtrlK");
    const closeFileItem = screen.getByRole("menuitem", { name: /Close File/ });
    expect(closeFileItem).toHaveTextContent("CtrlQ");
    const deleteSourceItem = screen.getByRole("menuitem", { name: /Delete File/ });
    expect(deleteSourceItem).toHaveTextContent("CtrlD");
    await user.click(closeFileItem);
    expect(menuState.dispatch).toHaveBeenCalledTimes(2);
  });

  it("requires confirmation before deleting the source from the File menu", async () => {
    const user = userEvent.setup();
    render(
      <TooltipProvider>
        <ThemeProvider>
          <MenuBarTest canExport canSave hasSource isChoosingSource={false} />
        </ThemeProvider>
      </TooltipProvider>,
    );

    await user.click(getMenuTrigger("File"));
    const deleteSourceItem = screen.getByRole("menuitem", { name: /Delete File/ });
    expect(deleteSourceItem).toHaveAttribute("data-variant", "destructive");

    await user.click(deleteSourceItem);
    expect(screen.getByRole("heading", { name: "Delete source file?" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("heading", { name: "Delete source file?" })).not.toBeInTheDocument();
  });

  it("keeps theme radios available in the View menu", async () => {
    const user = userEvent.setup();
    render(
      <TooltipProvider>
        <ThemeProvider>
          <MenuBarTest canExport canSave isChoosingSource={false} />
        </ThemeProvider>
      </TooltipProvider>,
    );

    const viewButton = getMenuTrigger("View");
    await user.click(viewButton);
    const appearanceItem = screen.getByRole("menuitem", { name: "Appearance" });
    appearanceItem.focus();
    await user.keyboard("{ArrowRight}");
    const themeItem = screen.getByText("Theme").closest<HTMLElement>('[role="menuitem"]');
    expect(themeItem).not.toBeNull();
    expect(themeItem).toHaveClass("min-w-48");
    themeItem?.focus();
    await user.keyboard("{ArrowRight}");

    for (const label of ["System", "Light", "Dark"]) {
      expect(
        screen.getByRole("menuitemradio", { name: label }).querySelector("svg"),
      ).not.toBeNull();
    }
    expect(screen.getByRole("menuitemradio", { name: "System" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByRole("menuitemradio", { name: "Light" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
    expect(screen.getByRole("menuitemradio", { name: "Dark" })).toHaveAttribute(
      "aria-checked",
      "false",
    );

    await user.click(screen.getByRole("menuitemradio", { name: "Light" }));
    expect(screen.getByRole("menuitemradio", { name: "Light" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await user.keyboard("{Escape}");
  });

  it("shows hex values for the primary color presets", async () => {
    const user = userEvent.setup();
    render(
      <TooltipProvider>
        <ThemeProvider>
          <MenuBarTest canExport canSave isChoosingSource={false} primaryColor="#4299e1" />
        </ThemeProvider>
      </TooltipProvider>,
    );

    await user.click(getMenuTrigger("View"));
    const appearanceItem = screen.getByRole("menuitem", { name: "Appearance" });
    appearanceItem.focus();
    await user.keyboard("{ArrowRight}");
    const colorItem = screen.getByText("Color").closest<HTMLElement>('[role="menuitem"]');
    expect(colorItem).not.toBeNull();
    colorItem?.focus();
    await user.keyboard("{ArrowRight}");

    for (const [name, hex] of [
      ["Amber", "#EFBF04"],
      ["Rose", "#E85D75"],
      ["Violet", "#8B6EE8"],
      ["Blue", "#4299E1"],
      ["Emerald", "#32A876"],
    ] as const) {
      const item = screen.getByRole("menuitemradio", { name: new RegExp(name) });
      expect(item).toHaveTextContent(hex);
      expect(item.querySelector('[aria-hidden="true"]')).not.toBeNull();
    }
  });

  it("switches between open menus on hover but stays click-to-open when closed", async () => {
    const user = userEvent.setup();
    render(
      <TooltipProvider>
        <ThemeProvider>
          <MenuBarTest canExport canSave isChoosingSource={false} />
        </ThemeProvider>
      </TooltipProvider>,
    );

    const fileButton = getMenuTrigger("File");
    const viewButton = getMenuTrigger("View");

    await user.click(fileButton);
    expect(screen.getByRole("menuitem", { name: /Open File/ })).toBeInTheDocument();
    await user.hover(viewButton);

    await waitFor(() => {
      expect(screen.queryByRole("menuitem", { name: /Open File/ })).not.toBeInTheDocument();
      expect(screen.getByRole("menuitem", { name: /Export Queue/ })).toBeInTheDocument();
    });

    await user.hover(fileButton);
    await waitFor(() => {
      expect(screen.getByRole("menuitem", { name: /Open File/ })).toBeInTheDocument();
      expect(screen.queryByRole("menuitem", { name: /Export Queue/ })).not.toBeInTheDocument();
    });
  });

  it("closes the active menu on the first outside click after hovering to another menu", async () => {
    const user = userEvent.setup();
    renderMenus();

    await user.click(getMenuTrigger("File"));
    for (const menuName of ["View", "Help"]) {
      await user.hover(getMenuTrigger(menuName));
    }

    await waitFor(() => {
      expect(screen.getByRole("menuitem", { name: /Check for Updates/ })).toBeInTheDocument();
    });

    await user.click(document.body);

    expect(screen.queryByRole("menuitem", { name: /Check for Updates/ })).not.toBeInTheDocument();
  });

  it("does not focus the previous trigger while switching menus with the pointer", async () => {
    const user = userEvent.setup();
    renderMenus();

    const fileButton = getMenuTrigger("File");
    const viewButton = getMenuTrigger("View");
    const helpButton = getMenuTrigger("Help");

    await user.click(fileButton);
    await user.hover(viewButton);
    expect(fileButton).not.toHaveFocus();

    await user.hover(helpButton);
    expect(viewButton).not.toHaveFocus();
  });

  it("restores focus to the trigger after closing a keyboard-opened menu", async () => {
    const user = userEvent.setup();
    renderMenus();

    const fileButton = getMenuTrigger("File");
    fileButton.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("menuitem", { name: /Open File/ })).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(fileButton).toHaveFocus();
  });

  it("switches between submenus immediately on hover", async () => {
    const user = userEvent.setup();
    render(
      <TooltipProvider>
        <ThemeProvider>
          <MenuBarTest canExport canSave isChoosingSource={false} />
        </ThemeProvider>
      </TooltipProvider>,
    );

    await user.click(getMenuTrigger("View"));
    const appearanceItem = screen.getByRole("menuitem", { name: "Appearance" });
    appearanceItem.focus();
    await user.keyboard("{ArrowRight}");
    const themeItem = screen.getByRole("menuitem", { name: "Theme" });
    const colorItem = screen.getByRole("menuitem", { name: /^Color/ });

    await user.hover(themeItem);
    await waitFor(() => expect(screen.getAllByRole("menu")).toHaveLength(3));
    const themeSubmenu = screen.getAllByRole("menu").at(-1);
    expect(themeSubmenu).toBeDefined();
    expect(
      within(themeSubmenu!).getByRole("menuitemradio", { name: "System" }),
    ).toBeInTheDocument();

    await user.hover(colorItem);
    await waitFor(() => expect(screen.getAllByRole("menu")).toHaveLength(3));
    const colorSubmenu = screen.getAllByRole("menu").at(-1);
    expect(colorSubmenu).toBeDefined();
    expect(
      within(colorSubmenu!).getByRole("menuitemradio", { name: /Amber#EFBF04/ }),
    ).toBeInTheDocument();
    expect(
      within(colorSubmenu!).queryByRole("menuitem", { name: "System" }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByRole("menu")).toHaveLength(3);
  });
});

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { DEFAULT_TOOL_DEFAULTS, type ToolDefaults } from "@/app/tool-settings";
import { ThemeProvider } from "@/app/theme/ThemeProvider";
import { AppUpdatesContext } from "@/app/contexts/app-updates-context";
import { TooltipProvider } from "@/components/ui/tooltip";
import { openExternalUrl } from "@/lib/open-external-url";
import { STORAGE_KEYS } from "@/lib/storage";
import { ContextMenus as AppContextMenus } from "../ContextMenus";
import type { QueueFinishAction } from "@/lib/tauri/queue";
import packageJson from "../../../../../../package.json";

const menuState = vi.hoisted(() => ({
  app: {
    isChoosingSource: false,
    hasSource: false,
    session: {
      status: "ready" as const,
      source: null as { selection: { sourceId: string } } | null,
    },
    exportQueue: [] as Array<{ status: "queued" | "rendering" }>,
    queueStarted: false,
    queueFinishAction: "nothing" as QueueFinishAction,
    availableQueueFinishActions: ["exit", "nothing"] as QueueFinishAction[],
    handleChooseSource: vi.fn(),
    handleCloseFile: vi.fn(),
    setQueueStarted: vi.fn(),
    cancelActiveExport: vi.fn(),
    cancelQueue: vi.fn(),
    setQueueFinishAction: vi.fn(),
    handleSetAudioMerge: vi.fn(),
  },
  sourceDetails: {
    isReady: true,
    source: null as { selection: { sourceId: string } } | null,
    sourceId: null as string | null,
    crop: { x: 0, y: 0, width: 1, height: 1 },
  },
  viewState: {
    toolDefaults: {
      safeTrimFollowingEnabled: true,
      loopPlaybackEnabled: true,
      segmentPlaybackEnabled: true,
      mergeAudioEnabled: false,
    } as ToolDefaults,
    setToolDefault: vi.fn(),
    resetToolDefaults: vi.fn(),
    dispatch: vi.fn(),
  },
  exportPanel: {
    startFastCut: vi.fn(),
    openOptimizedDialog: vi.fn(),
  },
}));

vi.mock("@/app/hooks/useEditorSession", () => ({
  useEditorSession: () => menuState.app,
}));

vi.mock("@/app/hooks/useSourceDetails", () => ({
  useSourceDetails: () => menuState.sourceDetails,
}));

vi.mock("@/app/hooks/useEditorViewState", () => ({
  useEditorViewState: () => menuState.viewState,
}));

vi.mock("@/app/store/hooks", () => ({
  useAppDispatch: () => menuState.viewState.dispatch,
  useAppSelector: () => menuState.viewState.toolDefaults,
}));

vi.mock("@/app/hooks/useExportPanelController", () => ({
  useExportPanelController: () => menuState.exportPanel,
}));

vi.mock("@/lib/open-external-url", () => ({
  openExternalUrl: vi.fn(),
}));

describe("ContextMenus", () => {
  const versionMenuLabel = `Version ${packageJson.version}`;

  type MenuTestOverrides = {
    isChoosingSource?: boolean;
    hasSource?: boolean;
    canSave?: boolean;
    canExport?: boolean;
    onChooseSource?: () => void;
    onCloseFile?: () => void;
    onSave?: () => void;
    onExport?: () => void;
    queueStarted?: boolean;
    hasQueuedItems?: boolean;
    hasActiveItem?: boolean;
    onQueueStartedChange?: (enabled: boolean) => void;
    onCancelActive?: () => void;
    onCancelQueue?: () => void;
    queueFinishAction?: QueueFinishAction;
    availableQueueFinishActions?: QueueFinishAction[];
    onQueueFinishActionChange?: (action: QueueFinishAction) => void;
    toolDefaults?: ToolDefaults;
    onToolDefaultChange?: (key: keyof ToolDefaults, enabled: boolean) => void;
    onResetToolDefaults?: () => void;
  };

  function configureMenuState(overrides: MenuTestOverrides = {}, notify: () => void = () => {}) {
    menuState.app.isChoosingSource = overrides.isChoosingSource ?? false;
    menuState.app.hasSource = overrides.hasSource ?? false;
    menuState.app.session.source = overrides.hasSource
      ? { selection: { sourceId: "source-id" } }
      : null;
    menuState.app.exportQueue = [
      ...(overrides.hasQueuedItems ? [{ status: "queued" as const }] : []),
      ...(overrides.hasActiveItem ? [{ status: "rendering" as const }] : []),
    ];
    menuState.app.queueStarted = overrides.queueStarted ?? false;
    menuState.app.queueFinishAction = overrides.queueFinishAction ?? "nothing";
    menuState.app.availableQueueFinishActions = overrides.availableQueueFinishActions ?? [
      "exit",
      "nothing",
    ];
    menuState.app.handleChooseSource = vi.fn(overrides.onChooseSource);
    menuState.app.handleCloseFile = vi.fn(overrides.onCloseFile);
    menuState.app.setQueueStarted = vi.fn(overrides.onQueueStartedChange);
    menuState.app.cancelActiveExport = vi.fn(overrides.onCancelActive);
    menuState.app.cancelQueue = vi.fn(overrides.onCancelQueue);
    menuState.app.setQueueFinishAction = vi.fn(overrides.onQueueFinishActionChange);
    menuState.viewState.toolDefaults = overrides.toolDefaults ?? { ...DEFAULT_TOOL_DEFAULTS };
    const setToolDefault =
      overrides.onToolDefaultChange ??
      ((key: keyof ToolDefaults, enabled: boolean) => {
        menuState.viewState.toolDefaults[key] = enabled;
      });
    menuState.viewState.setToolDefault = vi.fn((key: keyof ToolDefaults, enabled: boolean) => {
      setToolDefault(key, enabled);
      notify();
    });
    const resetToolDefaults =
      overrides.onResetToolDefaults ??
      (() => {
        menuState.viewState.toolDefaults = { ...DEFAULT_TOOL_DEFAULTS };
      });
    menuState.viewState.resetToolDefaults = vi.fn(() => {
      resetToolDefaults();
      notify();
    });
    menuState.viewState.dispatch = vi.fn(
      (action: { type: string; payload?: { key: keyof ToolDefaults; enabled: boolean } }) => {
        if (action.type === "preferences/toolDefaultChanged" && action.payload) {
          setToolDefault(action.payload.key, action.payload.enabled);
        }
        if (action.type === "preferences/toolDefaultsReset") {
          resetToolDefaults();
        }
        notify();
      },
    );
    menuState.sourceDetails.isReady = overrides.canExport ?? true;
    menuState.sourceDetails.crop =
      overrides.canSave === false
        ? { x: 0.1, y: 0, width: 0.9, height: 1 }
        : { x: 0, y: 0, width: 1, height: 1 };
    menuState.exportPanel.startFastCut = vi.fn(overrides.onSave);
    menuState.exportPanel.openOptimizedDialog = vi.fn(overrides.onExport);
  }

  function ContextMenus(overrides: MenuTestOverrides = {}) {
    const [, forceUpdate] = useState(0);
    const initialized = useRef(false);
    if (!initialized.current) {
      configureMenuState(overrides, () => forceUpdate((value) => value + 1));
      initialized.current = true;
    }
    return <AppContextMenus />;
  }

  function renderMenus(overrides: MenuTestOverrides = {}) {
    return render(
      <TooltipProvider>
        <ThemeProvider>
          <ContextMenus {...overrides} />
        </ThemeProvider>
      </TooltipProvider>,
    );
  }

  it("places Queue before Settings", () => {
    renderMenus();
    const menuButtons = screen
      .getByRole("navigation", { name: "Application menus" })
      .querySelectorAll("button");
    const labels = [...menuButtons].map((button) => button.textContent);
    expect(labels.indexOf("Queue")).toBeLessThan(labels.indexOf("Settings"));
  });

  it("shows the opt-in queue start control only when queued work is waiting", async () => {
    const user = userEvent.setup();
    const onQueueStartedChange = vi.fn();
    renderMenus({ hasQueuedItems: true, onQueueStartedChange });

    await user.click(screen.getByRole("button", { name: "Queue" }));
    const startItem = screen.getByRole("menuitem", { name: /Start queue/ });
    expect(within(startItem).getByRole("switch")).toBeInTheDocument();
    expect(startItem).toHaveAttribute("aria-keyshortcuts", "Enter");
    expect(screen.getAllByRole("separator")).toHaveLength(2);

    await user.click(startItem);
    expect(onQueueStartedChange).toHaveBeenCalledWith(true);
  });

  it("requires confirmation before canceling the queue", async () => {
    const user = userEvent.setup();
    const onCancelQueue = vi.fn();
    renderMenus({ hasQueuedItems: true, hasActiveItem: true, onCancelQueue });

    await user.click(screen.getByRole("button", { name: "Queue" }));
    expect(screen.getByRole("menuitem", { name: "Skip" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Cancel" })).toBeInTheDocument();

    await user.click(screen.getByRole("menuitem", { name: "Cancel" }));
    expect(screen.getByRole("heading", { name: "Cancel export queue?" })).toBeInTheDocument();
    expect(onCancelQueue).not.toHaveBeenCalled();

    const cancelButtons = screen.getAllByRole("button", { name: "Cancel" });
    await user.click(cancelButtons[1]!);
    expect(onCancelQueue).toHaveBeenCalledOnce();
  });

  it("selects an available queue finish action", async () => {
    const user = userEvent.setup();
    const onQueueFinishActionChange = vi.fn();
    renderMenus({
      availableQueueFinishActions: ["exit", "nothing"],
      onQueueFinishActionChange,
    });

    await user.click(screen.getByRole("button", { name: "Queue" }));
    const finishItem = screen.getByRole("menuitem", { name: /On queue finished/ });
    finishItem.focus();
    await user.keyboard("{ArrowRight}");
    await user.click(screen.getByRole("menuitem", { name: "Exit" }));
    expect(onQueueFinishActionChange).toHaveBeenCalledWith("exit");
  });

  it("opens Help links with the current release version", async () => {
    const user = userEvent.setup();
    render(
      <TooltipProvider>
        <ThemeProvider>
          <ContextMenus
            isChoosingSource={false}
            canSave
            canExport
            onChooseSource={vi.fn()}
            onSave={vi.fn()}
            onExport={vi.fn()}
          />
        </ThemeProvider>
      </TooltipProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Help" }));
    expect(screen.getByRole("menuitem", { name: "Changelog" })).toHaveTextContent("Changelog");
    expect(screen.getByRole("menuitem", { name: "Check for Updates…" })).toHaveTextContent(
      "Check for Updates…",
    );
    expect(screen.getByRole("menuitem", { name: "Support the Project" })).toHaveTextContent(
      "Support the Project",
    );
    expect(screen.getByRole("menuitem", { name: versionMenuLabel })).toHaveTextContent(
      packageJson.version,
    );
    expect(screen.getAllByRole("separator")).toHaveLength(2);

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

    await user.click(screen.getByRole("menuitem", { name: "Changelog" }));
    await user.click(screen.getByRole("button", { name: "Help" }));
    await user.click(screen.getByRole("menuitem", { name: "Project Page" }));
    await user.click(screen.getByRole("button", { name: "Help" }));
    await user.click(screen.getByRole("menuitem", { name: "Support the Project" }));
    await user.click(screen.getByRole("button", { name: "Help" }));
    await user.click(screen.getByRole("menuitem", { name: versionMenuLabel }));

    expect(vi.mocked(openExternalUrl).mock.calls).toEqual([
      ["https://github.com/vakot/easytrim-editor/releases"],
      ["https://github.com/vakot/easytrim-editor"],
      ["https://ko-fi.com/vakot"],
      [`https://github.com/vakot/easytrim-editor/releases/tag/v${packageJson.version}`],
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
            <ContextMenus
              isChoosingSource={false}
              canSave
              canExport
              onChooseSource={vi.fn()}
              onSave={vi.fn()}
              onExport={vi.fn()}
            />
          </AppUpdatesContext.Provider>
        </ThemeProvider>
      </TooltipProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Help" }));
    const updateItem = screen.getByRole("menuitem", { name: "Up to Date" });
    expect(updateItem).toBeInTheDocument();
    expect(updateItem.querySelector("svg")).not.toBeNull();
  });

  it("shows a switch row for every configurable tool", async () => {
    const user = userEvent.setup();
    render(
      <TooltipProvider>
        <ThemeProvider>
          <ContextMenus
            isChoosingSource={false}
            canSave
            canExport
            onChooseSource={vi.fn()}
            onSave={vi.fn()}
            onExport={vi.fn()}
          />
        </ThemeProvider>
      </TooltipProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Settings" }));
    for (const label of ["Snap", "Loop", "Follow segment", "Merge audio"]) {
      const row = screen.getByRole("menuitem", { name: label });
      expect(within(row).getByRole("switch")).toBeInTheDocument();
    }
    const settingsMenu = screen.getAllByRole("menu").at(-1);
    expect(settingsMenu).toBeDefined();
    expect(within(settingsMenu!).getAllByRole("separator")).toHaveLength(3);
    expect(screen.queryByText("Timeline tools", { exact: true })).not.toBeInTheDocument();
    expect(screen.queryByText("Audio tools", { exact: true })).not.toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Snap" })).toContainElement(
      settingsMenu!.querySelector(".lucide-magnet"),
    );
    expect(screen.getByRole("menuitem", { name: "Loop" })).toContainElement(
      settingsMenu!.querySelector(".lucide-repeat"),
    );
    expect(screen.getByRole("menuitem", { name: "Follow segment" })).toContainElement(
      settingsMenu!.querySelector(".lucide-between-vertical-start"),
    );
  });

  it("resets tools defaults", async () => {
    const user = userEvent.setup();
    render(
      <TooltipProvider>
        <ThemeProvider>
          <ContextMenus
            isChoosingSource={false}
            canSave
            canExport
            onChooseSource={vi.fn()}
            onSave={vi.fn()}
            onExport={vi.fn()}
          />
        </ThemeProvider>
      </TooltipProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Settings" }));
    const loopRow = screen.getByRole("menuitem", { name: "Loop" });
    const loopSwitch = within(loopRow).getByRole("switch");
    await user.click(loopSwitch);
    expect(loopSwitch).not.toBeChecked();
    await user.click(screen.getByRole("menuitem", { name: "Reset to default" }));

    expect(loopSwitch).toBeChecked();
    expect(screen.getByRole("menuitem", { name: "Reset to default" })).toBeInTheDocument();
  });

  it("shows the default state in tool switch tooltips", async () => {
    const user = userEvent.setup();
    render(
      <TooltipProvider>
        <ThemeProvider>
          <ContextMenus
            isChoosingSource={false}
            canSave
            canExport
            onChooseSource={vi.fn()}
            onSave={vi.fn()}
            onExport={vi.fn()}
          />
        </ThemeProvider>
      </TooltipProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Settings" }));
    const loopRow = screen.getByRole("menuitem", { name: "Loop" });
    const loopSwitch = within(loopRow).getByRole("switch");
    const loopTrigger = loopSwitch.parentElement;
    expect(loopTrigger).not.toBeNull();
    await user.hover(loopTrigger!);
    await waitFor(() => {
      expect(screen.getByRole("tooltip")).toHaveTextContent("Enabled by default");
    });
  });

  it("shows disabled by default for disabled tool switches", async () => {
    const user = userEvent.setup();
    render(
      <TooltipProvider>
        <ThemeProvider>
          <ContextMenus
            isChoosingSource={false}
            canSave
            canExport
            onChooseSource={vi.fn()}
            onSave={vi.fn()}
            onExport={vi.fn()}
            toolDefaults={{
              safeTrimFollowingEnabled: false,
              loopPlaybackEnabled: false,
              segmentPlaybackEnabled: false,
              mergeAudioEnabled: false,
            }}
            onToolDefaultChange={vi.fn()}
          />
        </ThemeProvider>
      </TooltipProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Settings" }));
    const mergeSwitch = within(screen.getByRole("menuitem", { name: "Merge audio" })).getByRole(
      "switch",
    );
    const mergeTrigger = mergeSwitch.parentElement;
    expect(mergeTrigger).not.toBeNull();
    await user.hover(mergeTrigger!);
    await waitFor(() => {
      expect(screen.getByRole("tooltip")).toHaveTextContent("Disabled by default");
    });
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
            <ContextMenus
              isChoosingSource={false}
              canSave
              canExport
              onChooseSource={vi.fn()}
              onSave={vi.fn()}
              onExport={vi.fn()}
            />
          </AppUpdatesContext.Provider>
        </ThemeProvider>
      </TooltipProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Help" }));
    const updateItem = screen.getByRole("menuitem", { name: "Check for Updates…" });
    expect(updateItem).toBeInTheDocument();
    expect(updateItem.querySelector("svg")).not.toBeNull();
  });

  it("opens the File menu with its action and hotkey hint", async () => {
    const user = userEvent.setup();
    const onCloseFile = vi.fn();
    render(
      <TooltipProvider>
        <ThemeProvider>
          <ContextMenus
            isChoosingSource={false}
            hasSource
            canSave
            canExport
            onChooseSource={vi.fn()}
            onCloseFile={onCloseFile}
            onSave={vi.fn()}
            onExport={vi.fn()}
          />
        </ThemeProvider>
      </TooltipProvider>,
    );

    const fileButton = screen.getByRole("button", { name: "File" });
    expect(fileButton).toHaveAttribute("data-slot", "button");
    expect(fileButton).toHaveAttribute("data-size", "xs");
    expect(fileButton).toHaveClass("h-6");

    await user.click(fileButton);
    expect(screen.getByRole("separator")).toBeInTheDocument();

    const openFileItem = screen.getByRole("menuitem", { name: /Open File/ });
    expect(openFileItem).toHaveTextContent("Ctrl+O");
    expect(openFileItem).toHaveClass("min-w-48");
    await user.click(openFileItem);
    expect(screen.queryByRole("menuitem", { name: /Open File/ })).not.toBeInTheDocument();

    await user.click(fileButton);
    const closeFileItem = screen.getByRole("menuitem", { name: /Close File/ });
    expect(closeFileItem).toHaveTextContent("Ctrl+Q");
    await user.click(closeFileItem);
    expect(onCloseFile).toHaveBeenCalledOnce();
  });

  it("keeps Theme and Language metadata visible for every submenu option", async () => {
    const user = userEvent.setup();
    render(
      <TooltipProvider>
        <ThemeProvider>
          <ContextMenus
            isChoosingSource={false}
            canSave
            canExport
            onChooseSource={vi.fn()}
            onSave={vi.fn()}
            onExport={vi.fn()}
          />
        </ThemeProvider>
      </TooltipProvider>,
    );

    const viewButton = screen.getByRole("button", { name: "View" });
    await user.click(viewButton);
    const themeItem = screen.getByText("Theme").closest<HTMLElement>('[role="menuitem"]');
    expect(themeItem).not.toBeNull();
    expect(themeItem).toHaveClass("min-w-48");
    themeItem?.focus();
    await user.keyboard("{ArrowRight}");

    for (const label of ["System", "Light", "Dark"]) {
      expect(screen.getByRole("menuitem", { name: label }).querySelector("svg")).not.toBeNull();
    }
    expect(screen.getByRole("menuitem", { name: "System" })).toHaveAttribute(
      "data-selected",
      "true",
    );
    expect(screen.getByRole("menuitem", { name: "Light" })).toHaveAttribute(
      "data-selected",
      "false",
    );
    expect(screen.getByRole("menuitem", { name: "Dark" })).toHaveAttribute(
      "data-selected",
      "false",
    );

    await user.click(screen.getByRole("menuitem", { name: "Light" }));
    expect(screen.getByRole("menuitem", { name: "Light" })).toHaveAttribute(
      "data-selected",
      "true",
    );
    await user.keyboard("{Escape}");
    await user.keyboard("{Escape}");
    const settingsButton = screen.getByRole("button", { name: "Settings" });
    await user.click(settingsButton);
    const languageItem = screen.getByRole("menuitem", { name: /Language/ });
    expect(languageItem).not.toBeNull();
    languageItem?.focus();
    await user.keyboard("{ArrowRight}");

    expect(screen.getByRole("menuitem", { name: /English/ })).toHaveTextContent("EN");
    expect(screen.getByRole("menuitem", { name: /Slov/ })).toHaveTextContent("SK");
    expect(screen.getByRole("menuitem", { name: /English/ })).toHaveAttribute(
      "data-selected",
      "true",
    );
    expect(screen.getByRole("menuitem", { name: /Slov/ })).toHaveAttribute(
      "data-selected",
      "false",
    );
    await user.click(screen.getByRole("menuitem", { name: /English/ }));
    expect(screen.queryByRole("menuitem", { name: /English/ })).not.toBeInTheDocument();
  });

  it("shows hex values and accepts custom input as soon as it is valid", async () => {
    const user = userEvent.setup();
    localStorage.setItem(
      STORAGE_KEYS.preferences,
      JSON.stringify({ primaryColor: "blue", customPrimaryColor: "#123456" }),
    );
    render(
      <TooltipProvider>
        <ThemeProvider>
          <ContextMenus
            isChoosingSource={false}
            canSave
            canExport
            onChooseSource={vi.fn()}
            onSave={vi.fn()}
            onExport={vi.fn()}
          />
        </ThemeProvider>
      </TooltipProvider>,
    );

    await user.click(screen.getByRole("button", { name: "View" }));
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
      const item = screen.getByRole("menuitem", { name: new RegExp(name) });
      expect(item).toHaveTextContent(hex);
      expect(item.querySelector('[aria-hidden="true"]')).not.toBeNull();
    }
    const customItem = screen.getByRole("menuitem", { name: /Custom/ });
    expect(customItem).toHaveTextContent("#123456");
    expect(customItem.querySelector('[aria-hidden="true"]')).not.toBeNull();
    await user.click(screen.getByRole("menuitem", { name: /Amber/ }));
    expect(screen.getByRole("menuitem", { name: /Amber/ })).toBeInTheDocument();

    await user.click(customItem);
    expect(document.documentElement).toHaveAttribute("data-primary-color", "#123456");

    const spectrum = await screen.findByRole("button", { name: /Theme color spectrum/ });
    expect(spectrum).toBeVisible();
    Object.defineProperty(spectrum, "getBoundingClientRect", {
      value: () => new DOMRect(0, 0, 192, 192),
    });
    fireEvent.pointerDown(spectrum, { pointerId: 1, clientX: 96, clientY: 96 });
    expect(customItem).toHaveTextContent("#808080");
    expect(colorItem?.querySelector('[aria-hidden="true"]')).toHaveStyle({
      backgroundColor: "rgb(128, 128, 128)",
    });
    fireEvent.pointerCancel(spectrum, { pointerId: 1 });
    expect(customItem).toHaveTextContent("#123456");
    const hexInput = screen.getByRole("textbox", { name: "Custom hex" });
    expect(hexInput).toHaveValue("123456");
    expect(hexInput.previousElementSibling).toHaveAttribute("aria-hidden", "true");
    await user.clear(hexInput);
    expect(hexInput.previousElementSibling).toHaveTextContent("#");
    fireEvent.change(hexInput, { target: { value: "abcde" } });
    expect(hexInput).toHaveValue("abcde");
    fireEvent.change(hexInput, { target: { value: "abcdef" } });
    expect(document.documentElement).toHaveAttribute("data-primary-color", "#abcdef");

    const reopenedCustomItem = screen.getByRole("menuitem", { name: /Custom/ });
    await user.click(reopenedCustomItem);
    const reopenedSpectrum = await screen.findByRole("button", { name: /Theme color spectrum/ });
    const reopenedHexInput = screen.getByRole("textbox", { name: "Custom hex" });
    fireEvent.change(reopenedHexInput, { target: { value: "abcdeg" } });
    expect(document.documentElement).toHaveAttribute("data-primary-color", "#abcdef");

    const colorMenus = screen.getAllByRole("menu", { name: "Color" });
    const customMenu = colorMenus[colorMenus.length - 1];
    expect(customMenu).toBeDefined();
    Object.defineProperty(customItem, "getBoundingClientRect", {
      value: () => new DOMRect(0, 0, 200, 32),
    });
    Object.defineProperty(customMenu, "getBoundingClientRect", {
      value: () => new DOMRect(204, 0, 210, 240),
    });
    fireEvent.pointerLeave(customItem, { clientX: 199, clientY: 16 });
    fireEvent.pointerMove(reopenedSpectrum, { clientX: 208, clientY: 16 });
    expect(screen.getByRole("button", { name: /Theme color spectrum/ })).toBeVisible();

    reopenedHexInput.focus();
    await user.keyboard("{Enter}");
    expect(screen.queryByRole("menuitem", { name: /Custom/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Theme color spectrum/ })).not.toBeInTheDocument();
  });

  it("switches between open menus on hover but stays click-to-open when closed", async () => {
    const user = userEvent.setup();
    render(
      <TooltipProvider>
        <ThemeProvider>
          <ContextMenus
            isChoosingSource={false}
            canSave
            canExport
            onChooseSource={vi.fn()}
            onSave={vi.fn()}
            onExport={vi.fn()}
          />
        </ThemeProvider>
      </TooltipProvider>,
    );

    const fileButton = screen.getByRole("button", { name: "File" });
    const viewButton = screen.getByRole("button", { name: "View" });

    await user.click(fileButton);
    expect(screen.getByRole("menuitem", { name: /Open File/ })).toBeInTheDocument();
    await user.hover(viewButton);

    await waitFor(() => {
      expect(screen.queryByRole("menuitem", { name: /Open File/ })).not.toBeInTheDocument();
      expect(screen.getByRole("menuitem", { name: /Theme/ })).toBeInTheDocument();
    });

    await user.hover(fileButton);
    await waitFor(() => {
      expect(screen.getByRole("menuitem", { name: /Open File/ })).toBeInTheDocument();
      expect(screen.queryByRole("menuitem", { name: /Theme/ })).not.toBeInTheDocument();
    });
  });

  it("closes the active menu on the first outside click after hovering to another menu", async () => {
    const user = userEvent.setup();
    renderMenus();

    await user.click(screen.getByRole("button", { name: "File" }));
    for (const menuName of ["View", "Queue", "Settings", "Help"]) {
      await user.hover(screen.getByRole("button", { name: menuName }));
    }

    await waitFor(() => {
      expect(screen.getByRole("menuitem", { name: /Check for Updates/ })).toBeInTheDocument();
    });

    await user.click(document.body);

    expect(screen.queryByRole("menuitem", { name: /Check for Updates/ })).not.toBeInTheDocument();
  });

  it("switches between submenus immediately on hover", async () => {
    const user = userEvent.setup();
    render(
      <TooltipProvider>
        <ThemeProvider>
          <ContextMenus
            isChoosingSource={false}
            canSave
            canExport
            onChooseSource={vi.fn()}
            onSave={vi.fn()}
            onExport={vi.fn()}
          />
        </ThemeProvider>
      </TooltipProvider>,
    );

    await user.click(screen.getByRole("button", { name: "View" }));
    const themeItem = screen.getByRole("menuitem", { name: /Theme/ });
    const colorItem = screen.getByRole("menuitem", { name: /Color/ });

    fireEvent.pointerMove(themeItem, { pointerType: "mouse" });
    const themeSubmenu = screen.getAllByRole("menu").at(-1);
    expect(themeSubmenu).toBeDefined();
    expect(within(themeSubmenu!).getByRole("menuitem", { name: "System" })).toBeInTheDocument();

    fireEvent.pointerMove(colorItem, { pointerType: "mouse" });
    const colorSubmenu = screen.getAllByRole("menu").at(-1);
    expect(colorSubmenu).toBeDefined();
    expect(
      within(colorSubmenu!).getByRole("menuitem", { name: /Amber#EFBF04/ }),
    ).toBeInTheDocument();
    expect(
      within(colorSubmenu!).queryByRole("menuitem", { name: "System" }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByRole("menu")).toHaveLength(2);
  });
});

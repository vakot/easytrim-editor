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

import { TooltipProvider } from "@/components/ui/tooltip";

import { AppUpdatesContext } from "@/app/contexts/app-updates-context";
import { DEFAULT_PREFERENCES, type Preferences } from "@/app/preferences";
import { ThemeProvider } from "@/app/theme/ThemeProvider";
import type { SourceRef } from "@/domain/source";
import { getCurrentVersion } from "@/lib/app-version.utils";
import { openExternalUrl } from "@/lib/open-external-url.utils";
import type { QueueFinishAction } from "@/lib/tauri/queue.types";

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
    queueStarted: false,
    queueFinishAction: "nothing" as QueueFinishAction,
    availableQueueFinishActions: ["exit", "nothing"] as QueueFinishAction[],
  },
  preferences: {
    snapPlaybackEnabledDefault: true,
    loopPlaybackEnabledDefault: true,
    segmentPlaybackEnabledDefault: true,
    autoStartQueueEnabled: true,
    mergeAudioEnabledDefault: false,
  } as Preferences,
  theme: {
    preference: "system" as "system" | "light" | "dark",
    primaryColor: "amber" as string,
    customPrimaryColor: "#efbf04" as `#${string}`,
  },
}));

const defaultAppUpdates = {
  status: "idle" as const,
  availableVersion: null,
  isInstalling: false,
  checkForUpdates: vi.fn(async () => undefined),
  installUpdate: vi.fn(async () => undefined),
};

function render(ui: ReactElement) {
  return renderWithTestingLibrary(
    <AppUpdatesContext.Provider value={defaultAppUpdates}>{ui}</AppUpdatesContext.Provider>,
  );
}

function getMenuTrigger(name: string) {
  return within(screen.getByRole("menubar", { name: "Application menus" })).getByRole("menuitem", {
    name,
  });
}

vi.mock("@/app/store/redux-hooks", () => ({
  useAppDispatch: () => menuState.dispatch,
  useAppSelector: (selector: (state: unknown) => unknown) =>
    selector({
      preferences: menuState.preferences,
      theme: menuState.theme,
      importWorkflow: menuState.importWorkflow,
      source: {
        status: menuState.source.selection && menuState.source.isReady ? "ready" : "idle",
        source: menuState.source.selection,
        media: menuState.source.media,
        error: null,
        capabilities: { status: "checking" },
      },
      crop: menuState.crop,
      export: {
        queue: menuState.export.queue,
        queueStarted: menuState.export.queueStarted,
        queueFinishAction: menuState.export.queueFinishAction,
        availableQueueFinishActions: menuState.export.availableQueueFinishActions,
        optimizedDialogOpen: false,
        optimizedSettings: null,
        optimizedPlanRequestId: null,
        commandPreview: "",
        commandPreviewError: null,
        launchError: null,
      },
    }),
}));

vi.mock("@/lib/open-external-url.utils", () => ({
  openExternalUrl: vi.fn(),
}));

describe("MenuBarTest", () => {
  const currentVersion = getCurrentVersion();
  const versionMenuLabel = `Version ${currentVersion}`;

  type MenuTestOverrides = {
    availableQueueFinishActions?: QueueFinishAction[];
    canExport?: boolean;
    canSave?: boolean;
    customPrimaryColor?: `#${string}`;
    hasActiveItem?: boolean;
    hasQueuedItems?: boolean;
    hasSource?: boolean;
    isChoosingSource?: boolean;
    onPreferenceChange?: (key: keyof Preferences, enabled: boolean) => void;
    onPreferencesReset?: () => void;
    preferences?: Preferences;
    primaryColor?: string;
    queueFinishAction?: QueueFinishAction;
    queueStarted?: boolean;
    themePreference?: "system" | "light" | "dark";
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
    menuState.export.queueStarted = overrides.queueStarted ?? false;
    menuState.export.queueFinishAction = overrides.queueFinishAction ?? "nothing";
    menuState.export.availableQueueFinishActions = overrides.availableQueueFinishActions ?? [
      "exit",
      "nothing",
    ];
    menuState.preferences = overrides.preferences ?? { ...DEFAULT_PREFERENCES };
    menuState.theme.preference = overrides.themePreference ?? "system";
    menuState.theme.primaryColor = overrides.primaryColor ?? "amber";
    menuState.theme.customPrimaryColor = overrides.customPrimaryColor ?? "#efbf04";
    const setPreference =
      overrides.onPreferenceChange ??
      ((key: keyof Preferences, enabled: boolean) => {
        menuState.preferences[key] = enabled;
      });

    const resetPreferences =
      overrides.onPreferencesReset ??
      (() => {
        menuState.preferences = { ...DEFAULT_PREFERENCES };
      });

    menuState.dispatch = vi.fn((action: { payload?: unknown; type: string }) => {
      if (
        action.type === "preferences/preferenceChanged" &&
        typeof action.payload === "object" &&
        action.payload !== null &&
        "key" in action.payload &&
        "enabled" in action.payload
      ) {
        const payload = action.payload as { enabled: boolean; key: keyof Preferences };
        setPreference(payload.key, payload.enabled);
      }
      if (action.type === "preferences/preferencesReset") {
        resetPreferences();
      }
      if (action.type === "theme/themePreferenceChanged") {
        menuState.theme.preference = action.payload as "system" | "light" | "dark";
      }
      if (action.type === "theme/primaryColorChanged") {
        menuState.theme.primaryColor = action.payload as string;
        if ((action.payload as string).startsWith("#")) {
          menuState.theme.customPrimaryColor = action.payload as `#${string}`;
        }
      }
      if (action.type === "theme/customPrimaryColorChanged") {
        menuState.theme.primaryColor = action.payload as string;
        menuState.theme.customPrimaryColor = action.payload as `#${string}`;
      }
      notify();
    });
  }

  function MenuBarTest(overrides: MenuTestOverrides = {}) {
    const [, forceUpdate] = useState(0);
    const initialized = useRef(false);
    if (!initialized.current) {
      configureMenuState(overrides, () => forceUpdate((value) => value + 1));
      initialized.current = true;
    }
    return (
      <ThemeProvider>
        <AppMenuBar />
      </ThemeProvider>
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

  it("places Queue before Settings", () => {
    renderMenus();
    const menuButtons = screen
      .getByRole("menubar", { name: "Application menus" })
      .querySelectorAll("button");

    const labels = [...menuButtons].map((button) => button.textContent);
    expect(labels.indexOf("Queue")).toBeLessThan(labels.indexOf("Settings"));
  });

  it("shows the opt-in queue start control only when queued work is waiting", async () => {
    const user = userEvent.setup();
    renderMenus({
      hasQueuedItems: true,
      preferences: { ...DEFAULT_PREFERENCES, autoStartQueueEnabled: false },
    });

    await user.click(getMenuTrigger("Queue"));
    const startItem = screen.getByRole("menuitem", { name: /Start queue/ });
    expect(startItem).toHaveAttribute("aria-keyshortcuts", "Enter");
    expect(screen.getAllByRole("separator")).toHaveLength(2);

    await user.click(startItem);
    expect(menuState.dispatch).toHaveBeenCalledWith(expect.any(Function));
  });

  it("requires confirmation before canceling the queue", async () => {
    const user = userEvent.setup();
    renderMenus({ hasQueuedItems: true, hasActiveItem: true });

    await user.click(getMenuTrigger("Queue"));
    expect(screen.getByRole("menuitem", { name: "Skip" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Cancel" })).toBeInTheDocument();

    await user.click(screen.getByRole("menuitem", { name: "Cancel" }));
    expect(screen.getByRole("heading", { name: "Cancel export queue?" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.queryByRole("heading", { name: "Cancel export queue?" })).not.toBeInTheDocument();

    await user.click(getMenuTrigger("Queue"));
    await user.click(screen.getByRole("menuitem", { name: "Cancel" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(menuState.dispatch).toHaveBeenCalledWith(expect.any(Function));
  });

  it("selects an available queue finish action", async () => {
    const user = userEvent.setup();
    renderMenus({
      availableQueueFinishActions: ["exit", "nothing"],
    });

    await user.click(getMenuTrigger("Queue"));
    const finishItem = screen.getByRole("menuitem", { name: /On queue finished/ });
    finishItem.focus();
    await user.keyboard("{ArrowRight}");
    await user.click(screen.getByRole("menuitemradio", { name: "Exit" }));
    expect(menuState.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: "export/queueFinishActionChanged", payload: "exit" }),
    );
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
    expect(screen.getByRole("menuitem", { name: versionMenuLabel })).toHaveTextContent(
      currentVersion,
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
    await user.click(getMenuTrigger("Help"));
    await user.click(screen.getByRole("menuitem", { name: "Project Page" }));
    await user.click(getMenuTrigger("Help"));
    await user.click(screen.getByRole("menuitem", { name: "Support the Project" }));
    await user.click(getMenuTrigger("Help"));
    await user.click(screen.getByRole("menuitem", { name: versionMenuLabel }));

    expect(vi.mocked(openExternalUrl).mock.calls).toEqual([
      ["https://github.com/vakot/easytrim-editor/releases"],
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

  it("shows a checkbox menu item for every configurable preference", async () => {
    const user = userEvent.setup();
    render(
      <TooltipProvider>
        <ThemeProvider>
          <MenuBarTest canExport canSave isChoosingSource={false} />
        </ThemeProvider>
      </TooltipProvider>,
    );

    await user.click(getMenuTrigger("Settings"));
    for (const label of ["Snap", "Loop", "Follow segment", "Auto-start Queue", "Merge audio"]) {
      expect(screen.getByRole("menuitemcheckbox", { name: label })).toBeInTheDocument();
    }
    const settingsMenu = screen.getAllByRole("menu").at(-1);
    expect(settingsMenu).toBeDefined();
    expect(within(settingsMenu!).getAllByRole("separator")).toHaveLength(4);
    expect(screen.queryByText("Timeline tools", { exact: true })).not.toBeInTheDocument();
    expect(screen.queryByText("Audio tools", { exact: true })).not.toBeInTheDocument();
    expect(screen.getByRole("menuitemcheckbox", { name: "Snap" })).toContainElement(
      settingsMenu!.querySelector(".lucide-magnet"),
    );
    expect(screen.getByRole("menuitemcheckbox", { name: "Loop" })).toContainElement(
      settingsMenu!.querySelector(".lucide-repeat"),
    );
    expect(screen.getByRole("menuitemcheckbox", { name: "Follow segment" })).toContainElement(
      settingsMenu!.querySelector(".lucide-between-vertical-start"),
    );
    expect(screen.getByRole("menuitemcheckbox", { name: "Auto-start Queue" })).toContainElement(
      settingsMenu!.querySelector(".lucide-play"),
    );
  });

  it("resets preference defaults", async () => {
    const user = userEvent.setup();
    render(
      <TooltipProvider>
        <ThemeProvider>
          <MenuBarTest canExport canSave isChoosingSource={false} />
        </ThemeProvider>
      </TooltipProvider>,
    );

    await user.click(getMenuTrigger("Settings"));
    const loopItem = screen.getByRole("menuitemcheckbox", { name: "Loop" });
    await user.click(loopItem);
    expect(loopItem).not.toBeChecked();
    await user.click(screen.getByRole("menuitem", { name: "Reset to default" }));

    expect(loopItem).toBeChecked();
    expect(screen.getByRole("menuitem", { name: "Reset to default" })).toBeInTheDocument();
  });

  it("shows the default state in preference item tooltips", async () => {
    const user = userEvent.setup();
    render(
      <TooltipProvider>
        <ThemeProvider>
          <MenuBarTest canExport canSave isChoosingSource={false} />
        </ThemeProvider>
      </TooltipProvider>,
    );

    await user.click(getMenuTrigger("Settings"));
    const loopItem = screen.getByRole("menuitemcheckbox", { name: "Loop" });
    await user.hover(loopItem);
    await waitFor(() => {
      expect(screen.getByRole("tooltip")).toHaveTextContent("Enabled by default");
    });
  });

  it("shows disabled by default for disabled preference items", async () => {
    const user = userEvent.setup();
    render(
      <TooltipProvider>
        <ThemeProvider>
          <MenuBarTest
            canExport
            canSave
            isChoosingSource={false}
            onPreferenceChange={vi.fn()}
            preferences={{
              snapPlaybackEnabledDefault: false,
              loopPlaybackEnabledDefault: false,
              segmentPlaybackEnabledDefault: false,
              autoStartQueueEnabled: false,
              mergeAudioEnabledDefault: false,
            }}
          />
        </ThemeProvider>
      </TooltipProvider>,
    );

    await user.click(getMenuTrigger("Settings"));
    const mergeItem = screen.getByRole("menuitemcheckbox", { name: "Merge audio" });
    await user.hover(mergeItem);
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
    expect(fileButton).toHaveAttribute("data-size", "xs");
    expect(fileButton).toHaveClass("h-6");

    await user.click(fileButton);
    expect(screen.getByRole("separator")).toBeInTheDocument();

    const openFileItem = screen.getByRole("menuitem", { name: /Open File/ });
    expect(openFileItem).toHaveTextContent("Ctrl+O");
    expect(openFileItem).toHaveClass("min-w-36");
    await user.click(openFileItem);
    expect(screen.queryByRole("menuitem", { name: /Open File/ })).not.toBeInTheDocument();

    await user.click(fileButton);
    const closeFileItem = screen.getByRole("menuitem", { name: /Close File/ });
    expect(closeFileItem).toHaveTextContent("Ctrl+Q");
    await user.click(closeFileItem);
    expect(menuState.dispatch).toHaveBeenCalledTimes(2);
  });

  it("keeps Theme and Language metadata visible for every submenu option", async () => {
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
    const themeItem = screen.getByText("Theme").closest<HTMLElement>('[role="menuitem"]');
    expect(themeItem).not.toBeNull();
    expect(themeItem).toHaveClass("min-w-36");
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
    await user.keyboard("{Escape}");
    const settingsButton = getMenuTrigger("Settings");
    await user.click(settingsButton);
    const languageItem = screen.getByRole("menuitem", { name: /Language/ });
    expect(languageItem).not.toBeNull();
    languageItem?.focus();
    await user.keyboard("{ArrowRight}");

    expect(screen.getByRole("menuitemradio", { name: /English/ })).toHaveTextContent("EN");
    expect(screen.getByRole("menuitemradio", { name: /Slov/ })).toHaveTextContent("SK");
    expect(screen.getByRole("menuitemradio", { name: /English/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByRole("menuitemradio", { name: /Slov/ })).toHaveAttribute(
      "aria-checked",
      "false",
    );
    await user.click(screen.getByRole("menuitemradio", { name: /English/ }));
    expect(screen.queryByRole("menuitemradio", { name: /English/ })).not.toBeInTheDocument();
  });

  it("shows hex values and accepts custom input as soon as it is valid", async () => {
    const user = userEvent.setup();
    render(
      <TooltipProvider>
        <ThemeProvider>
          <MenuBarTest
            canExport
            canSave
            customPrimaryColor="#123456"
            isChoosingSource={false}
            primaryColor="blue"
          />
        </ThemeProvider>
      </TooltipProvider>,
    );

    await user.click(getMenuTrigger("View"));
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
    const customItem = screen.getByRole("menuitem", { name: /Custom/ });
    expect(customItem).toHaveTextContent("#123456");
    expect(customItem.querySelector('[aria-hidden="true"]')).not.toBeNull();
    await user.click(screen.getByRole("menuitemradio", { name: /Amber/ }));
    expect(screen.getByRole("menuitemradio", { name: /Amber/ })).toBeInTheDocument();

    await user.click(screen.getByRole("menuitem", { name: /Custom/ }));
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

    await user.click(getMenuTrigger("File"));
    for (const menuName of ["View", "Queue", "Settings", "Help"]) {
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
    const queueButton = getMenuTrigger("Queue");

    await user.click(fileButton);
    await user.hover(viewButton);
    expect(fileButton).not.toHaveFocus();

    await user.hover(queueButton);
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
    const themeItem = screen.getByRole("menuitem", { name: /Theme/ });
    const colorItem = screen.getByRole("menuitem", { name: /Color/ });

    await user.hover(themeItem);
    await waitFor(() => expect(screen.getAllByRole("menu")).toHaveLength(2));
    const themeSubmenu = screen.getAllByRole("menu").at(-1);
    expect(themeSubmenu).toBeDefined();
    expect(
      within(themeSubmenu!).getByRole("menuitemradio", { name: "System" }),
    ).toBeInTheDocument();

    await user.hover(colorItem);
    await waitFor(() => expect(screen.getAllByRole("menu")).toHaveLength(2));
    const colorSubmenu = screen.getAllByRole("menu").at(-1);
    expect(colorSubmenu).toBeDefined();
    expect(
      within(colorSubmenu!).getByRole("menuitemradio", { name: /Amber#EFBF04/ }),
    ).toBeInTheDocument();
    expect(
      within(colorSubmenu!).queryByRole("menuitem", { name: "System" }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByRole("menu")).toHaveLength(2);
  });
});

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ThemeProvider } from "@/app/theme/ThemeProvider";
import { AppUpdatesContext } from "@/app/update-context";
import { TooltipProvider } from "@/components/ui/tooltip";
import { openExternalUrl } from "@/lib/open-external-url";
import { STORAGE_KEYS } from "@/lib/storage";
import { ContextMenus } from "../ContextMenus";
import packageJson from "../../../../../../package.json";

vi.mock("@/lib/open-external-url", () => ({
  openExternalUrl: vi.fn(),
}));

describe("ContextMenus", () => {
  const versionMenuLabel = `Version ${packageJson.version}`;

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
    expect(fileButton).toHaveAttribute("data-size", "sm");
    expect(fileButton).toHaveClass("h-7");

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
    expect(screen.getByRole("separator")).toBeInTheDocument();
    const themeItem = screen.getByText("Theme").closest<HTMLElement>('[role="menuitem"]');
    expect(themeItem).not.toBeNull();
    expect(themeItem).toHaveClass("min-w-56");
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
    await user.click(viewButton);
    const languageItem = screen.getByText("Language").closest<HTMLElement>('[role="menuitem"]');
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
    expect(screen.queryByRole("button", { name: /Theme color spectrum/ })).not.toBeInTheDocument();

    await user.hover(customItem);
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
    await user.type(hexInput, "abcdef");
    expect(hexInput).toHaveValue("abcdef");
    expect(document.documentElement).toHaveAttribute("data-primary-color", "#abcdef");
    await user.clear(hexInput);
    await user.type(hexInput, "abcdeg");
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
    fireEvent.pointerMove(spectrum, { clientX: 208, clientY: 16 });
    expect(screen.getByRole("button", { name: /Theme color spectrum/ })).toBeVisible();

    await user.clear(hexInput);
    await user.type(hexInput, "abcdef");
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

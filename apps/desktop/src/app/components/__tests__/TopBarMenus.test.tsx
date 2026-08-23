import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ThemeProvider } from "@/app/theme/ThemeProvider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TopBarMenus } from "../TopBarMenus";

describe("TopBarMenus", () => {
  it("opens the File menu with its action and hotkey hint", async () => {
    const user = userEvent.setup();
    render(
      <TooltipProvider>
        <ThemeProvider>
          <TopBarMenus
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

    await user.click(screen.getByRole("button", { name: "File" }));

    expect(screen.getByRole("menuitem", { name: /Open File/ })).toHaveTextContent("Ctrl+O");
  });

  it("keeps Theme and Language metadata visible for every submenu option", async () => {
    const user = userEvent.setup();
    render(
      <TooltipProvider>
        <ThemeProvider>
          <TopBarMenus
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
    const themeItem = screen.getByText("Theme").closest<HTMLElement>('[role="menuitem"]');
    expect(themeItem).not.toBeNull();
    themeItem?.focus();
    await user.keyboard("{ArrowRight}");

    for (const label of ["System", "Light", "Dark"]) {
      expect(screen.getByRole("menuitem", { name: label }).querySelector("svg")).not.toBeNull();
    }

    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "View" }));
    const languageItem = screen.getByText("Language").closest<HTMLElement>('[role="menuitem"]');
    expect(languageItem).not.toBeNull();
    languageItem?.focus();
    await user.keyboard("{ArrowRight}");

    expect(screen.getByRole("menuitem", { name: /English/ })).toHaveTextContent("EN");
    expect(screen.getByRole("menuitem", { name: /Slov/ })).toHaveTextContent("SK");
  });
});

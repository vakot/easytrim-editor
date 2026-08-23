import { render, screen, waitFor } from "@testing-library/react";
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

    const fileButton = screen.getByRole("button", { name: "File" });
    expect(fileButton).toHaveAttribute("data-slot", "button");
    expect(fileButton).toHaveAttribute("data-size", "sm");
    expect(fileButton).toHaveClass("h-7");

    await user.click(fileButton);

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

    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "View" }));
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
  });

  it("switches between open menus on hover but stays click-to-open when closed", async () => {
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

    const fileButton = screen.getByRole("button", { name: "File" });
    const editButton = screen.getByRole("button", { name: "Edit" });
    const viewButton = screen.getByRole("button", { name: "View" });

    await user.hover(editButton);
    expect(screen.queryByRole("menuitem", { name: /Save/ })).not.toBeInTheDocument();

    await user.click(fileButton);
    expect(screen.getByRole("menuitem", { name: /Open File/ })).toBeInTheDocument();
    await user.hover(editButton);

    await waitFor(() => {
      expect(screen.getByRole("menuitem", { name: /Save/ })).toHaveTextContent("Ctrl+S");
      expect(screen.queryByRole("menuitem", { name: /Open File/ })).not.toBeInTheDocument();
    });

    await user.hover(viewButton);
    await waitFor(() => {
      expect(screen.getByRole("menuitem", { name: /Theme/ })).toBeInTheDocument();
      expect(screen.queryByRole("menuitem", { name: /Save/ })).not.toBeInTheDocument();
    });

    await user.hover(fileButton);
    await waitFor(() => {
      expect(screen.getByRole("menuitem", { name: /Open File/ })).toBeInTheDocument();
      expect(screen.queryByRole("menuitem", { name: /Theme/ })).not.toBeInTheDocument();
    });
  });
});

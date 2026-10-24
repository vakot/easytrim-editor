import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { Button } from "@easytrim-editor/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@easytrim-editor/ui/tooltip";

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "../dropdown-menu";

function renderMenu(item: ReactNode) {
  render(
    <DropdownMenu defaultOpen>
      <DropdownMenuTrigger>Open</DropdownMenuTrigger>
      <DropdownMenuContent>{item}</DropdownMenuContent>
    </DropdownMenu>,
  );
}

function MenuTriggerTooltip() {
  return (
    <TooltipProvider delayDuration={0}>
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button type="button">Open menu</Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>Menu controls</TooltipContent>
        </Tooltip>
        <DropdownMenuContent>
          <DropdownMenuItem>Menu item</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </TooltipProvider>
  );
}

describe("DropdownMenu selection items", () => {
  it("moves focus into the menu and restores the trigger on Escape", async () => {
    const user = userEvent.setup();
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Open menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>First item</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    const trigger = screen.getByRole("button", { name: "Open menu" });
    await user.tab();
    expect(trigger).toHaveFocus();
    await user.keyboard("{Enter}");
    await waitFor(() => expect(screen.getByRole("menuitem", { name: "First item" })).toHaveFocus());

    await user.keyboard("{Escape}");
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(screen.queryByRole("menuitem", { name: "First item" })).not.toBeInTheDocument();
  });

  it("closes regular menu items by default", () => {
    const onSelect = vi.fn();
    renderMenu(<DropdownMenuItem onSelect={onSelect}>Item</DropdownMenuItem>);

    fireEvent.click(screen.getByRole("menuitem", { name: "Item" }));

    expect(onSelect).toHaveBeenCalledOnce();
    expect(onSelect.mock.calls[0]?.[0].defaultPrevented).toBe(false);
    expect(screen.queryByRole("menuitem", { name: "Item" })).not.toBeInTheDocument();
  });

  it("keeps regular menu items open when requested", () => {
    const onSelect = vi.fn();
    renderMenu(
      <DropdownMenuItem keepOpen onSelect={onSelect}>
        Item
      </DropdownMenuItem>,
    );

    fireEvent.click(screen.getByRole("menuitem", { name: "Item" }));

    expect(onSelect).toHaveBeenCalledOnce();
    expect(onSelect.mock.calls[0]?.[0].defaultPrevented).toBe(true);
    expect(screen.getByRole("menuitem", { name: "Item" })).toBeInTheDocument();
  });

  it("does not cancel regular item click handlers before selection", () => {
    const onClick = vi.fn();
    renderMenu(
      <DropdownMenuItem keepOpen onClick={onClick}>
        Item
      </DropdownMenuItem>,
    );

    const item = screen.getByRole("menuitem", { name: "Item" });
    fireEvent.click(item);

    expect(onClick).toHaveBeenCalledOnce();
    expect(onClick.mock.calls[0]?.[0].defaultPrevented).toBe(false);
    expect(item).toBeInTheDocument();
  });

  it("keeps checkbox menus open when requested", () => {
    const onCheckedChange = vi.fn();
    const onSelect = vi.fn((event: Event) => {
      expect(event.defaultPrevented).toBe(false);
    });

    renderMenu(
      <DropdownMenuCheckboxItem
        checked={false}
        keepOpen
        onCheckedChange={onCheckedChange}
        onSelect={onSelect}
      >
        Checkbox
      </DropdownMenuCheckboxItem>,
    );

    fireEvent.click(screen.getByRole("menuitemcheckbox", { name: "Checkbox" }));

    expect(onSelect).toHaveBeenCalledOnce();
    expect(onCheckedChange).toHaveBeenCalledWith(true);
    expect(onSelect.mock.calls[0]?.[0].defaultPrevented).toBe(true);
    expect(screen.getByRole("menuitemcheckbox", { name: "Checkbox" })).toBeInTheDocument();
  });

  it("keeps radio menus open when requested", () => {
    const onSelect = vi.fn((event: Event) => {
      expect(event.defaultPrevented).toBe(false);
    });

    const onValueChange = vi.fn();
    renderMenu(
      <DropdownMenuRadioGroup onValueChange={onValueChange} value="radio">
        <DropdownMenuRadioItem keepOpen onSelect={onSelect} value="radio">
          Radio
        </DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>,
    );

    fireEvent.click(screen.getByRole("menuitemradio", { name: "Radio" }));

    expect(onSelect).toHaveBeenCalledOnce();
    expect(onValueChange).toHaveBeenCalledWith("radio");
    expect(onSelect.mock.calls[0]?.[0].defaultPrevented).toBe(true);
    expect(screen.getByRole("menuitemradio", { name: "Radio" })).toBeInTheDocument();
  });

  it("keeps submenu triggers accessible when keepOpen is set", () => {
    renderMenu(
      <DropdownMenuSub>
        <DropdownMenuSubTrigger keepOpen>Submenu</DropdownMenuSubTrigger>
        <DropdownMenuSubContent>
          <DropdownMenuItem>Child</DropdownMenuItem>
        </DropdownMenuSubContent>
      </DropdownMenuSub>,
    );

    fireEvent.click(screen.getByRole("menuitem", { name: "Submenu" }));

    expect(screen.getByRole("menuitem", { name: "Child" })).toBeInTheDocument();
  });
});

describe("DropdownMenu triggers", () => {
  it("exposes the open state on an assigned Button trigger", async () => {
    const user = userEvent.setup();

    render(
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button>Menu</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>Menu content</DropdownMenuContent>
      </DropdownMenu>,
    );

    const button = screen.getByRole("button", { name: "Menu" });

    expect(button).toHaveAttribute("data-state", "closed");
    expect(button).not.toHaveAttribute("data-open");

    await user.click(button);

    expect(button).toHaveAttribute("data-state", "open");
    expect(button).toHaveAttribute("data-open", "true");
    expect(button).toHaveClass("data-open:bg-primary/80");

    fireEvent.pointerDown(button, { button: 0, ctrlKey: false });

    expect(button).toHaveAttribute("data-state", "closed");
    expect(button).not.toHaveAttribute("data-open");
  });

  it("closes a trigger tooltip when the menu opens", async () => {
    const user = userEvent.setup();
    render(<MenuTriggerTooltip />);
    const trigger = screen.getByRole("button", { name: "Open menu" });

    await user.hover(trigger);
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Menu controls");

    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Menu item" })).toBeInTheDocument();
  });
});

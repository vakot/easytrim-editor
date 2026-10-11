import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

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

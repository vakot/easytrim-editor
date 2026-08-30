import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import {
  Menubar,
  MenubarCheckboxItem,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarRadioGroup,
  MenubarRadioItem,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarTrigger,
} from "../menubar";

function renderMenu(item: ReactNode) {
  render(
    <Menubar defaultValue="menu">
      <MenubarMenu value="menu">
        <MenubarTrigger>Open</MenubarTrigger>
        <MenubarContent>{item}</MenubarContent>
      </MenubarMenu>
    </Menubar>,
  );
}

describe("Menubar selection items", () => {
  it("closes regular menu items by default", () => {
    const onSelect = vi.fn();
    renderMenu(<MenubarItem onSelect={onSelect}>Item</MenubarItem>);

    fireEvent.click(screen.getByRole("menuitem", { name: "Item" }));

    expect(onSelect).toHaveBeenCalledOnce();
    expect(onSelect.mock.calls[0]?.[0].defaultPrevented).toBe(false);
    expect(screen.queryByRole("menuitem", { name: "Item" })).not.toBeInTheDocument();
  });

  it("keeps regular menu items open when requested", () => {
    const onSelect = vi.fn();
    renderMenu(
      <MenubarItem keepOpen onSelect={onSelect}>
        Item
      </MenubarItem>,
    );

    fireEvent.click(screen.getByRole("menuitem", { name: "Item" }));

    expect(onSelect).toHaveBeenCalledOnce();
    expect(onSelect.mock.calls[0]?.[0].defaultPrevented).toBe(true);
    expect(screen.getByRole("menuitem", { name: "Item" })).toBeInTheDocument();
  });

  it("does not cancel regular item click handlers before selection", () => {
    const onClick = vi.fn();
    renderMenu(
      <MenubarItem keepOpen onClick={onClick}>
        Item
      </MenubarItem>,
    );

    const item = screen.getByRole("menuitem", { name: "Item" });
    fireEvent.click(item);

    expect(onClick).toHaveBeenCalledOnce();
    expect(onClick.mock.calls[0]?.[0].defaultPrevented).toBe(false);
    expect(item).toBeInTheDocument();
  });

  it("does not cancel mouse handlers before selection", () => {
    const onMouseDown = vi.fn();
    renderMenu(
      <MenubarItem keepOpen onMouseDown={onMouseDown}>
        Item
      </MenubarItem>,
    );

    const item = screen.getByRole("menuitem", { name: "Item" });
    fireEvent.mouseDown(item);

    expect(onMouseDown).toHaveBeenCalledOnce();
    expect(onMouseDown.mock.calls[0]?.[0].defaultPrevented).toBe(false);
    expect(item).toBeInTheDocument();
  });

  it("does not cancel keyboard handlers before selection", () => {
    const onKeyDown = vi.fn();
    renderMenu(
      <MenubarItem keepOpen onKeyDown={onKeyDown}>
        Item
      </MenubarItem>,
    );

    const item = screen.getByRole("menuitem", { name: "Item" });
    fireEvent.keyDown(item, { key: "Enter" });

    expect(onKeyDown).toHaveBeenCalledOnce();
    expect(onKeyDown.mock.calls[0]?.[0].defaultPrevented).toBe(true);
    expect(item).toBeInTheDocument();
  });

  it("closes checkbox menus by default", () => {
    const onSelect = vi.fn();
    renderMenu(
      <MenubarCheckboxItem checked={false} onSelect={onSelect}>
        Checkbox
      </MenubarCheckboxItem>,
    );

    fireEvent.click(screen.getByRole("menuitemcheckbox", { name: "Checkbox" }));

    expect(onSelect).toHaveBeenCalledOnce();
    expect(onSelect.mock.calls[0]?.[0].defaultPrevented).toBe(false);
    expect(screen.queryByRole("menuitemcheckbox", { name: "Checkbox" })).not.toBeInTheDocument();
  });

  it("keeps checkbox menus open when requested", () => {
    const onCheckedChange = vi.fn();
    const onSelect = vi.fn((event: Event) => {
      expect(event.defaultPrevented).toBe(false);
    });

    renderMenu(
      <MenubarCheckboxItem
        checked={false}
        keepOpen
        onCheckedChange={onCheckedChange}
        onSelect={onSelect}
      >
        Checkbox
      </MenubarCheckboxItem>,
    );

    fireEvent.click(screen.getByRole("menuitemcheckbox", { name: "Checkbox" }));

    expect(onSelect).toHaveBeenCalledOnce();
    expect(onCheckedChange).toHaveBeenCalledWith(true);
    expect(onSelect.mock.calls[0]?.[0].defaultPrevented).toBe(true);
    expect(screen.getByRole("menuitemcheckbox", { name: "Checkbox" })).toBeInTheDocument();
  });

  it("does not cancel checkbox item click handlers before selection", () => {
    const onClick = vi.fn();
    renderMenu(
      <MenubarCheckboxItem checked={false} keepOpen onClick={onClick}>
        Checkbox
      </MenubarCheckboxItem>,
    );

    const item = screen.getByRole("menuitemcheckbox", { name: "Checkbox" });
    fireEvent.click(item);

    expect(onClick).toHaveBeenCalledOnce();
    expect(onClick.mock.calls[0]?.[0].defaultPrevented).toBe(false);
    expect(item).toBeInTheDocument();
  });

  it("closes radio menus by default", () => {
    const onSelect = vi.fn();
    renderMenu(
      <MenubarRadioGroup value="radio">
        <MenubarRadioItem onSelect={onSelect} value="radio">
          Radio
        </MenubarRadioItem>
      </MenubarRadioGroup>,
    );

    fireEvent.click(screen.getByRole("menuitemradio", { name: "Radio" }));

    expect(onSelect).toHaveBeenCalledOnce();
    expect(onSelect.mock.calls[0]?.[0].defaultPrevented).toBe(false);
    expect(screen.queryByRole("menuitemradio", { name: "Radio" })).not.toBeInTheDocument();
  });

  it("keeps radio menus open when requested", () => {
    const onSelect = vi.fn((event: Event) => {
      expect(event.defaultPrevented).toBe(false);
    });

    const onValueChange = vi.fn();
    renderMenu(
      <MenubarRadioGroup onValueChange={onValueChange} value="radio">
        <MenubarRadioItem keepOpen onSelect={onSelect} value="radio">
          Radio
        </MenubarRadioItem>
      </MenubarRadioGroup>,
    );

    fireEvent.click(screen.getByRole("menuitemradio", { name: "Radio" }));

    expect(onSelect).toHaveBeenCalledOnce();
    expect(onValueChange).toHaveBeenCalledWith("radio");
    expect(onSelect.mock.calls[0]?.[0].defaultPrevented).toBe(true);
    expect(screen.getByRole("menuitemradio", { name: "Radio" })).toBeInTheDocument();
  });

  it("does not cancel radio item click handlers before selection", () => {
    const onClick = vi.fn();
    renderMenu(
      <MenubarRadioGroup value="radio">
        <MenubarRadioItem keepOpen onClick={onClick} value="radio">
          Radio
        </MenubarRadioItem>
      </MenubarRadioGroup>,
    );

    const item = screen.getByRole("menuitemradio", { name: "Radio" });
    fireEvent.click(item);

    expect(onClick).toHaveBeenCalledOnce();
    expect(onClick.mock.calls[0]?.[0].defaultPrevented).toBe(false);
    expect(item).toBeInTheDocument();
  });

  it("keeps submenu triggers accessible when keepOpen is set", () => {
    renderMenu(
      <MenubarSub>
        <MenubarSubTrigger keepOpen>Submenu</MenubarSubTrigger>
        <MenubarSubContent>
          <MenubarItem>Child</MenubarItem>
        </MenubarSubContent>
      </MenubarSub>,
    );

    fireEvent.click(screen.getByRole("menuitem", { name: "Submenu" }));

    expect(screen.getByRole("menuitem", { name: "Child" })).toBeInTheDocument();
  });
});

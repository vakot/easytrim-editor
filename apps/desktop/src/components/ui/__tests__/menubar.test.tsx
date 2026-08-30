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
    const onSelect = vi.fn();
    renderMenu(
      <MenubarCheckboxItem checked={false} keepOpen onSelect={onSelect}>
        Checkbox
      </MenubarCheckboxItem>,
    );

    fireEvent.click(screen.getByRole("menuitemcheckbox", { name: "Checkbox" }));

    expect(onSelect).toHaveBeenCalledOnce();
    expect(onSelect.mock.calls[0]?.[0].defaultPrevented).toBe(true);
    expect(screen.getByRole("menuitemcheckbox", { name: "Checkbox" })).toBeInTheDocument();
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
    const onSelect = vi.fn();
    renderMenu(
      <MenubarRadioGroup value="radio">
        <MenubarRadioItem keepOpen onSelect={onSelect} value="radio">
          Radio
        </MenubarRadioItem>
      </MenubarRadioGroup>,
    );

    fireEvent.click(screen.getByRole("menuitemradio", { name: "Radio" }));

    expect(onSelect).toHaveBeenCalledOnce();
    expect(onSelect.mock.calls[0]?.[0].defaultPrevented).toBe(true);
    expect(screen.getByRole("menuitemradio", { name: "Radio" })).toBeInTheDocument();
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

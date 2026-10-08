import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";

describe("Combobox", () => {
  it("constrains the native ScrollArea viewport for scrolling", () => {
    render(
      <Combobox defaultOpen label="Search items">
        <ComboboxContent>
          <ComboboxInput aria-label="Search items" />
          <ComboboxList>
            <ComboboxEmpty>No items found</ComboboxEmpty>
            <ComboboxGroup>
              {Array.from({ length: 20 }, (_, index) => (
                <ComboboxItem key={index} value={`item-${index}`}>
                  Item {index}
                </ComboboxItem>
              ))}
            </ComboboxGroup>
          </ComboboxList>
        </ComboboxContent>
      </Combobox>,
    );

    const list = screen.getByRole("listbox");
    const scrollArea = list.closest<HTMLElement>('[data-slot="scroll-area"]');
    const viewport = list.closest<HTMLElement>('[data-slot="scroll-area-viewport"]');

    expect(scrollArea).toHaveClass("*:data-[slot=scroll-area-viewport]:max-h-72");
    expect(viewport).not.toHaveClass("max-h-72");
    expect(viewport).toHaveStyle({ overflowY: "scroll" });
    if (!viewport) throw new Error("Combobox scroll viewport is missing");

    Object.defineProperties(viewport, {
      clientHeight: { configurable: true, value: 100 },
      scrollHeight: { configurable: true, value: 500 },
    });

    const wheelWasNotPrevented = fireEvent.wheel(screen.getByRole("option", { name: "Item 0" }), {
      deltaY: 120,
    });

    expect(wheelWasNotPrevented).toBe(true);
    expect(viewport.scrollTop).toBe(0);
  });
});

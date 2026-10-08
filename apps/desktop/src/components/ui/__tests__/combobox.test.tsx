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
  it("scrolls the list with mouse-wheel input", () => {
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
    const viewport = list.closest<HTMLElement>('[data-slot="scroll-area-viewport"]');
    expect(viewport).not.toBeNull();
    if (!viewport) throw new Error("Combobox scroll viewport is missing");

    Object.defineProperties(viewport, {
      clientHeight: { configurable: true, value: 100 },
      scrollHeight: { configurable: true, value: 500 },
    });

    fireEvent.wheel(screen.getByRole("option", { name: "Item 0" }), { deltaY: 120 });

    expect(viewport.scrollTop).toBe(120);
  });
});

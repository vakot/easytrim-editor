import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
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
  it("keeps filtering and selection behavior for existing consumers", () => {
    function ExistingComboboxConsumer() {
      const [value, setValue] = useState("");
      const [selected, setSelected] = useState("");

      return (
        <Combobox>
          <ComboboxInput aria-label="Search items" onValueChange={setValue} value={value} />
          <ComboboxContent>
            <ComboboxList>
              <ComboboxGroup>
                <ComboboxItem onSelect={setSelected} value="alpha">
                  Alpha
                </ComboboxItem>
                <ComboboxItem onSelect={setSelected} value="beta">
                  Beta
                </ComboboxItem>
              </ComboboxGroup>
            </ComboboxList>
          </ComboboxContent>
          <output data-testid="selected-value">{selected}</output>
        </Combobox>
      );
    }

    render(<ExistingComboboxConsumer />);
    const input = screen.getByRole("combobox");

    expect(
      input.parentElement?.querySelector('[data-slot="input-group-addon"]'),
    ).toBeInTheDocument();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "bet" } });
    expect(screen.getByRole("option", { name: "Beta" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Alpha" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("option", { name: "Beta" }));
    expect(screen.getByTestId("selected-value")).toHaveTextContent("beta");
    expect(input).toHaveValue("bet");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

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

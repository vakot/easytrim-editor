import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import {
  Autocomplete,
  AutocompleteAnchor,
  AutocompleteContent,
  AutocompleteEmpty,
  AutocompleteInput,
  AutocompleteInputGroup,
  AutocompleteItem,
  AutocompleteList,
  AutocompleteTrigger,
} from "@/components/ui/autocomplete";

const suggestions = ["Match source", "15 FPS", "24 FPS", "30 FPS"];

function ControlledAutocomplete({ initialValue = "" }: { initialValue?: string }) {
  const [value, setValue] = useState(initialValue);

  return (
    <Autocomplete label="Frame rate">
      <AutocompleteAnchor>
        <AutocompleteInputGroup>
          <AutocompleteInput
            aria-label="Frame rate"
            id="test-autocomplete"
            onValueChange={setValue}
            placeholder="Match source"
            value={value}
          />
        </AutocompleteInputGroup>
      </AutocompleteAnchor>
      <AutocompleteTrigger asChild>
        <button type="button">Toggle suggestions</button>
      </AutocompleteTrigger>
      <AutocompleteContent>
        <AutocompleteEmpty>No matching frame rates</AutocompleteEmpty>
        <AutocompleteList>
          {suggestions.map((suggestion) => (
            <AutocompleteItem key={suggestion} value={suggestion}>
              {suggestion}
            </AutocompleteItem>
          ))}
        </AutocompleteList>
      </AutocompleteContent>
    </Autocomplete>
  );
}

describe("Autocomplete", () => {
  it("filters suggestions as the user types and lets them select one", () => {
    render(<ControlledAutocomplete />);
    const input = screen.getByRole("combobox", { name: "Frame rate" });

    expect(input).toHaveValue("");
    expect(input).toHaveAttribute("placeholder", "Match source");
    expect(input.parentElement?.querySelector('[data-slot="input-group-addon"]')).toBeNull();

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "30" } });

    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "30 FPS" })).toHaveClass("px-2.5");
    expect(screen.queryByRole("option", { name: "24 FPS" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("option", { name: "30 FPS" }));

    expect(input).toHaveValue("30");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("keeps a custom value on blur when no suggestion is active", () => {
    render(<ControlledAutocomplete />);
    const input = screen.getByRole("combobox", { name: "Frame rate" });

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "17.5" } });
    fireEvent.blur(input);

    expect(input).toHaveValue("17.5");
  });

  it("supports keyboard selection of a filtered suggestion", () => {
    render(<ControlledAutocomplete />);
    const input = screen.getByRole("combobox", { name: "Frame rate" });

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "30" } });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(input).toHaveValue("30");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("opens suggestions from an adjacent trigger affordance", () => {
    render(<ControlledAutocomplete />);

    fireEvent.click(screen.getByRole("button", { name: "Toggle suggestions" }));

    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });

  it("keeps a restored formatted value searchable", () => {
    render(<ControlledAutocomplete initialValue="24 FPS" />);
    const input = screen.getByRole("combobox", { name: "Frame rate" });

    fireEvent.focus(input);

    expect(screen.getByRole("option", { name: "24 FPS" })).toBeInTheDocument();
  });
});

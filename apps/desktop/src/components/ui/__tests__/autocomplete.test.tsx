import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { Autocomplete } from "@/components/ui/autocomplete";

function ControlledAutocomplete({ initialValue = "" }: { initialValue?: string }) {
  const [value, setValue] = useState(initialValue);

  return (
    <Autocomplete
      id="test-autocomplete"
      label="Frame rate"
      onValueChange={setValue}
      placeholder="Match source"
      suggestions={["Match source", "15 FPS", "24 FPS", "30 FPS"]}
      value={value}
    />
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

    expect(input).toHaveValue("30 FPS");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

    fireEvent.click(input);
    expect(screen.getByRole("listbox")).toBeInTheDocument();
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

    expect(input).toHaveValue("30 FPS");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

    fireEvent.click(input);
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });
});

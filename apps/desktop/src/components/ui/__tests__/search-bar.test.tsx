import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { HighlightedText, SearchBar } from "../search-bar";

describe("SearchBar", () => {
  it.each([
    ["xs", "h-6", "pl-6", "text-xs", "size-3"],
    ["sm", "h-7", "pl-7", "text-sm", "size-3.5"],
    ["default", "h-8", "pl-8", "text-sm", "size-4"],
    ["lg", "h-9", "pl-8", "text-sm", "size-4"],
  ] as const)("supports the %s button size", (size, height, padding, text, iconSize) => {
    const { container } = render(
      <SearchBar aria-label="Search" onValueChange={vi.fn()} size={size} value="" />,
    );

    const input = screen.getByRole("searchbox", { name: "Search" });
    const icon = container.querySelector("svg");

    expect(input).toHaveClass(height, padding, text);
    expect(icon).toHaveClass(iconSize);
  });

  it("reports controlled value changes", () => {
    const onValueChange = vi.fn();

    render(<SearchBar aria-label="Search" onValueChange={onValueChange} value="" />);

    fireEvent.change(screen.getByRole("searchbox", { name: "Search" }), {
      target: { value: "clip" },
    });

    expect(onValueChange).toHaveBeenCalledWith("clip");
  });

  it("applies layout classes to the wrapper", () => {
    const { container } = render(
      <SearchBar aria-label="Search" className="mb-2" onValueChange={vi.fn()} value="" />,
    );

    expect(container.firstElementChild).toHaveClass("relative", "mb-2");
    expect(screen.getByRole("searchbox", { name: "Search" })).not.toHaveClass("mb-2");
  });

  it("highlights every matching substring", () => {
    render(<HighlightedText query="clip" text="clip-clip.mp4" />);

    const matches = screen.getAllByText("clip");
    expect(matches).toHaveLength(2);
    expect(matches[0]?.tagName).toBe("MARK");
  });
});

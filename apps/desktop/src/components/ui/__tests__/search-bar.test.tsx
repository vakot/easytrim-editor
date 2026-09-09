import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { HighlightedText, SearchBar } from "../search-bar";

describe("SearchBar", () => {
  it("reports controlled value changes", () => {
    const onValueChange = vi.fn();

    render(<SearchBar aria-label="Search" onValueChange={onValueChange} value="" />);

    fireEvent.change(screen.getByRole("searchbox", { name: "Search" }), {
      target: { value: "clip" },
    });

    expect(onValueChange).toHaveBeenCalledWith("clip");
  });

  it("highlights every matching substring", () => {
    render(<HighlightedText query="clip" text="clip-clip.mp4" />);

    const matches = screen.getAllByText("clip");
    expect(matches).toHaveLength(2);
    expect(matches[0]?.tagName).toBe("MARK");
  });
});

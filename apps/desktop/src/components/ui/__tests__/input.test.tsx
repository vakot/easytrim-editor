import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Input } from "../input";

describe("Input", () => {
  it("allows consumers to override the value text size", () => {
    render(<Input aria-label="Custom input" className="text-xs" />);

    expect(screen.getByRole("textbox", { name: "Custom input" })).toHaveClass("text-xs");
    expect(screen.getByRole("textbox", { name: "Custom input" })).not.toHaveClass("text-sm");
  });
});

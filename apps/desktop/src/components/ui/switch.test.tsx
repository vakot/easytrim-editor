import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Switch } from "./switch";

describe("Switch", () => {
  it("keeps consumer classes on the switch root", () => {
    render(<Switch aria-label="Toggle" className="w-11" />);

    const root = screen.getByRole("switch", { name: "Toggle" });
    expect(root).toHaveClass("w-11");
    expect(root.querySelector('[data-slot="switch-thumb"]')).not.toHaveClass("w-11");
  });
});

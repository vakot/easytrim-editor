import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Button } from "../button";

describe("Button", () => {
  it("exposes an open data state when expanded", () => {
    render(
      <Button aria-expanded={true} variant="success">
        Open
      </Button>,
    );

    const button = screen.getByRole("button", { name: "Open" });

    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(button).toHaveAttribute("data-open", "true");
    expect(button).toHaveClass("bg-success/10", "text-success");
  });

  it("does not expose an open data state when collapsed", () => {
    render(<Button aria-expanded={false}>Closed</Button>);

    expect(screen.getByRole("button", { name: "Closed" })).not.toHaveAttribute("data-open");
  });
});

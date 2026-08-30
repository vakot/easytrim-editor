import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { Button } from "../button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "../dropdown-menu";

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

  it("tracks the open state of an assigned dropdown menu", async () => {
    const user = userEvent.setup();

    render(
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button>Menu</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>Menu content</DropdownMenuContent>
      </DropdownMenu>,
    );

    const button = screen.getByRole("button", { name: "Menu" });

    expect(button).not.toHaveAttribute("data-open");

    await user.click(button);

    expect(button).toHaveAttribute("data-open", "true");

    fireEvent.pointerDown(button, { button: 0, ctrlKey: false });

    expect(button).not.toHaveAttribute("data-open");
  });
});

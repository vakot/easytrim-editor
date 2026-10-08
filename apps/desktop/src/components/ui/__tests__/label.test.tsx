import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { Checkbox } from "../checkbox";
import { Label } from "../label";

describe("Label", () => {
  it("allows label text selection without breaking checkbox activation", async () => {
    const user = userEvent.setup();
    render(
      <div>
        <Checkbox id="merge-audio" />
        <Label htmlFor="merge-audio">Merge selected tracks</Label>
      </div>,
    );

    const label = screen.getByText("Merge selected tracks");
    const checkbox = screen.getByRole("checkbox");

    expect(label).not.toHaveClass("select-none");
    expect(checkbox).not.toBeChecked();

    await user.click(label);

    expect(checkbox).toBeChecked();
  });
});

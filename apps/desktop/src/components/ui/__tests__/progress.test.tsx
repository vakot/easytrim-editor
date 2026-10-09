import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Progress } from "../progress";

describe("Progress", () => {
  it("exposes indeterminate work without a misleading percentage", () => {
    render(
      <Progress
        aria-label="Export progress"
        aria-valuetext="Preparing GIF palette"
        indeterminate
        value={0}
      />,
    );

    const progress = screen.getByRole("progressbar", { name: "Export progress" });

    expect(progress).not.toHaveAttribute("aria-valuenow");
    expect(progress).toHaveAttribute("aria-valuetext", "Preparing GIF palette");
  });
});

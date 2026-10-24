import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TooltipProvider } from "@easytrim-editor/ui/tooltip";

import { RelativeTimestamp } from "../relative-timestamp";

function renderRelativeTimestamp(timestamp: number | undefined) {
  return render(
    <TooltipProvider>
      <RelativeTimestamp timestamp={timestamp} />
    </TooltipProvider>,
  );
}

describe("RelativeTimestamp", () => {
  it("formats the timestamp in the active application language", () => {
    renderRelativeTimestamp(Date.now() * 1_000 - 5 * 60_000_000);

    expect(screen.getByText("5 minutes ago")).toBeInTheDocument();
  });

  it("renders the translated fallback when the timestamp is unavailable", () => {
    renderRelativeTimestamp(undefined);

    expect(screen.getByText("Unknown")).toBeInTheDocument();
  });
});

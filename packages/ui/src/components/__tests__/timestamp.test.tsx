import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Timestamp } from "../timestamp";
import { TooltipProvider } from "../tooltip";

function renderTimestamp(timestamp: number | undefined) {
  return render(
    <TooltipProvider>
      <Timestamp className="timestamp" locale="en" timestamp={timestamp} unknownLabel="Unknown" />
    </TooltipProvider>,
  );
}

describe("Timestamp", () => {
  it("updates the visible relative value as time passes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 20, 12, 0, 0, 0));
    const timestampMicros = Date.now() * 1_000 - 1_000_000;

    try {
      renderTimestamp(timestampMicros);
      expect(screen.getByText("1 second ago")).toBeInTheDocument();

      act(() => vi.advanceTimersByTime(1_000));

      expect(screen.getByText("2 seconds ago")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("renders the configured fallback when the timestamp is unavailable", () => {
    renderTimestamp(undefined);

    expect(screen.getByText("Unknown")).toBeInTheDocument();
  });

  it("shows the exact timestamp in the tooltip", async () => {
    const updatedAt = new Date(Date.now() - 2 * 86_400_000);
    const expectedExactTime = new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(updatedAt);

    const user = userEvent.setup();

    renderTimestamp(updatedAt.getTime() * 1_000);
    await user.hover(
      screen.getByText(new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(updatedAt)),
    );

    expect(await screen.findByRole("tooltip")).toHaveTextContent(expectedExactTime);
  });
});

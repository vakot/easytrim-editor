import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";

import type { ExportQueueItem } from "@/app/store/slices/editing-instances-slice";
import type { ExportAttempt } from "@/domain/editing-instance";

import { ExportQueueItemContext } from "../../contexts/ExportQueueItemContext";
import { ExportQueueItemMetrics } from "../ExportQueueItemMetrics";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe("ExportQueueItemMetrics", () => {
  it("uses the shared estimated-time tooltip while rendering", async () => {
    const user = userEvent.setup();
    renderMetrics({
      estimatedElapsedTimeMs: 25_000,
      estimatedTotalTimeMs: 36_000,
      status: "rendering",
    });

    await user.hover(screen.getByText("0:25 / 0:36"));

    expect(await screen.findByText("export.estimate.timeLabel")).toBeInTheDocument();
  });

  it("uses the export-duration tooltip for completed exports", async () => {
    const user = userEvent.setup();
    renderMetrics({ durationMs: 25_000, status: "completed" });

    await user.hover(screen.getByText("0:25"));

    expect(await screen.findByText("queue.metrics.durationTooltip")).toBeInTheDocument();
  });
});

function renderMetrics({
  durationMs = 25_000,
  estimatedElapsedTimeMs,
  estimatedTotalTimeMs,
  status,
}: {
  durationMs?: number;
  estimatedElapsedTimeMs?: number;
  estimatedTotalTimeMs?: number;
  status: "completed" | "rendering";
}) {
  const attempt = {
    metrics: {
      durationMs,
      estimatedElapsedTimeMs,
      estimatedTotalTimeMs,
      progressPercent: 69,
    },
    request: { trim: { endMicros: 1_000_000, startMicros: 0 } },
    route: "gif",
    snapshot: { source: {} },
    state: { operationId: "operation-1", startedAt: 1, status },
  } as ExportAttempt;

  const item = {
    attempt,
    instance: { snapshot: { source: {} } },
  } as unknown as ExportQueueItem;

  return render(
    <TooltipProvider>
      <ExportQueueItemContext.Provider value={item}>
        <ExportQueueItemMetrics />
      </ExportQueueItemContext.Provider>
    </TooltipProvider>,
  );
}

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ExportQueueItem } from "@/app/store/slices/export-slice";
import { TooltipProvider } from "@/components/ui/tooltip";

const mocks = vi.hoisted(() => ({ queue: [] as ExportQueueItem[] }));

vi.mock("@/app/hooks/useAppUpdates", () => ({
  useAppUpdates: () => ({
    status: "idle",
    availableVersion: null,
    isInstalling: false,
    checkForUpdates: vi.fn(),
    installUpdate: vi.fn(),
  }),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/app/store/hooks", () => ({
  useAppSelector: () => mocks.queue,
}));

import { StatusBar } from "../StatusBar";
import { selectStatusBarExport } from "../status-bar-utils";

function exportToast(overrides: Partial<ExportQueueItem>): ExportQueueItem {
  return {
    id: "export-1",
    route: "optimized",
    request: {
      sourceId: "source-1",
      trim: { startMicros: 0, endMicros: 1_000_000 },
      audioTracks: [],
      mergeAudio: false,
      resolution: { width: 1920, height: 1080 },
      arguments: "",
    },
    outputId: "output-1",
    operationId: "operation-1",
    filename: "clip.mp4",
    path: "C:/Exports/clip.mp4",
    status: "rendering",
    startedAt: 1_000,
    durationMs: 1_000,
    progressPercent: 42,
    ...overrides,
  };
}

function renderQueue(queue: ExportQueueItem[]) {
  mocks.queue = queue;
  return render(
    <TooltipProvider>
      <StatusBar />
    </TooltipProvider>,
  );
}

describe("StatusBar", () => {
  it("keeps the last started export while a newer item is queued", () => {
    const completed = exportToast({ status: "completed", progressPercent: 96 });
    const queued = exportToast({
      id: "export-2",
      operationId: null,
      status: "queued",
      startedAt: null,
      durationMs: null,
    });

    expect(selectStatusBarExport([completed, queued])).toBe(completed);
  });

  it("keeps the last export visible through an empty selection transition", () => {
    const completed = exportToast({
      status: "completed",
      filename: "finished.mp4",
      path: "C:/Exports/finished.mp4",
      currentFrame: 8,
      totalFrames: 8,
    });
    const { rerender } = renderQueue([completed]);

    mocks.queue = [exportToast({ status: "queued", startedAt: null })];
    rerender(
      <TooltipProvider>
        <StatusBar />
      </TooltipProvider>,
    );
    expect(screen.getByText("finished.mp4")).toBeInTheDocument();

    mocks.queue = [
      exportToast({
        id: "export-2",
        operationId: "operation-2",
        filename: "next.mp4",
        path: "C:/Exports/next.mp4",
        status: "rendering",
        startedAt: 2_000,
        currentFrame: 2,
        totalFrames: 10,
      }),
    ];
    rerender(
      <TooltipProvider>
        <StatusBar />
      </TooltipProvider>,
    );
    expect(screen.getByText("next.mp4")).toBeInTheDocument();
  });

  it("shows completed exports as a green full progress indicator", () => {
    renderQueue([exportToast({ status: "completed", currentFrame: 4, totalFrames: 8 })]);
    const progress = screen.getByRole("progressbar");
    expect(progress).toHaveAttribute("aria-valuenow", "100");
    expect(progress.firstElementChild).toHaveClass("bg-emerald-400");
  });

  it("renders placeholders for metrics that are not available yet", () => {
    renderQueue([exportToast({ status: "rendering", startedAt: null, operationId: null })]);
    expect(screen.getByText("0f / 0f")).toBeInTheDocument();
    expect(screen.getByText("0 FPS")).toBeInTheDocument();
  });

  it.each(["failed", "canceled"] as const)(
    "shows %s exports with destructive styling",
    (status) => {
      renderQueue([exportToast({ status, progressPercent: 37 })]);
      const progress = screen.getByRole("progressbar");
      expect(progress).toHaveAttribute("aria-valuenow", "37");
      expect(progress.firstElementChild).toHaveClass("bg-destructive");
    },
  );
});

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";

import type { ExportQueueItem } from "@/app/store/slices/export-slice";

const mocks = vi.hoisted(() => ({
  installUpdate: vi.fn(),
  queue: [] as ExportQueueItem[],
  requestWindowShutdown: vi.fn(),
  status: "idle" as "available" | "idle",
  availableVersion: null as string | null,
}));

vi.mock("@/app/hooks/useAppUpdates", () => ({
  useAppUpdates: () => ({
    status: mocks.status,
    availableVersion: mocks.availableVersion,
    isInstalling: false,
    checkForUpdates: vi.fn(),
    installUpdate: mocks.installUpdate,
  }),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/app/store/redux-hooks", () => ({
  useAppSelector: () => mocks.queue,
}));
vi.mock("@/lib/tauri/window", () => ({
  requestWindowShutdown: mocks.requestWindowShutdown,
}));

import { StatusBar } from "../StatusBar";

function exportToast(overrides: Partial<ExportQueueItem>): ExportQueueItem {
  return {
    addedAt: 1,
    id: "export-1",
    snapshot: {
      source: { displayName: "source.mp4", sourcePath: "C:/Media/source.mp4" },
      trim: { startMicros: 0, endMicros: 1_000_000 },
      crop: null,
      audio: { master: { enabled: true, volumePercent: 50 }, tracks: [], mergeAudio: false },
    },
    route: "optimized",
    request: {
      sourcePath: "C:/Media/source.mp4",
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
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.status = "idle";
    mocks.availableVersion = null;
    mocks.queue = [];
  });

  it("routes an available update through the shutdown confirmation", async () => {
    const user = userEvent.setup();
    mocks.status = "available";
    mocks.availableVersion = "2.0.0";
    renderQueue([]);

    await user.click(screen.getByRole("button", { name: "app.actions.update" }));

    expect(mocks.requestWindowShutdown).toHaveBeenCalledWith(mocks.installUpdate);
    expect(mocks.installUpdate).not.toHaveBeenCalled();
  });

  it("does not show a completed export while a newer item is queued", () => {
    const completed = exportToast({ status: "completed", progressPercent: 96 });
    const queued = exportToast({
      id: "export-2",
      operationId: null,
      status: "queued",
      startedAt: null,
      durationMs: null,
    });

    renderQueue([completed, queued]);

    expect(screen.queryByText("clip.mp4")).not.toBeInTheDocument();
  });

  it("clears the status bar while waiting for the next export to start", () => {
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
    expect(screen.queryByText("finished.mp4")).not.toBeInTheDocument();

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

  it("renders placeholders for metrics that are not available yet", () => {
    renderQueue([exportToast({ status: "rendering", startedAt: null, operationId: null })]);
    expect(screen.getByText("0f / 0f")).toBeInTheDocument();
    expect(screen.getByText("0 FPS")).toBeInTheDocument();
  });

  it.each(["completed", "failed", "canceled"] as const)(
    "clears the export details for %s exports",
    (status) => {
      renderQueue([exportToast({ status, progressPercent: 37 })]);
      expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
      expect(screen.queryByText("clip.mp4")).not.toBeInTheDocument();
    },
  );
});

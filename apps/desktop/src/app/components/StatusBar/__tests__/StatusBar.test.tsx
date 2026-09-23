import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";

const mocks = vi.hoisted(() => ({
  activeAttempt: null as unknown,
  installUpdate: vi.fn(),
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
  useAppSelector: () => mocks.activeAttempt,
}));
vi.mock("@/lib/tauri/window", () => ({
  requestWindowShutdown: mocks.requestWindowShutdown,
}));

import { StatusBar } from "../StatusBar";

function renderStatusBar() {
  return render(
    <TooltipProvider>
      <StatusBar />
    </TooltipProvider>,
  );
}

function renderingAttempt() {
  return {
    attempt: {
      id: "attempt-1",
      output: { displayName: "clip.mp4", displayPath: "C:/Exports/clip.mp4", outputId: "output-1" },
      metrics: {
        bitrate: "1200 kbits/s",
        currentFrame: 42,
        estimatedElapsedTimeMs: 500,
        estimatedFileSizeBytes: 2_000_000,
        estimatedTotalTimeMs: 1_000,
        fileSizeBytes: 1_000_000,
        fps: 60,
        progressPercent: 42,
        totalFrames: 100,
        durationMs: 100,
      },
      state: { operationId: "operation-1", startedAt: 1, status: "rendering" },
    },
    instance: { id: "instance-1" },
  };
}

describe("StatusBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.activeAttempt = null;
    mocks.status = "idle";
    mocks.availableVersion = null;
  });

  it("routes an available update through the shutdown confirmation", async () => {
    const user = userEvent.setup();
    mocks.status = "available";
    mocks.availableVersion = "2.0.0";
    renderStatusBar();

    await user.click(screen.getByRole("button", { name: "app.actions.update" }));

    expect(mocks.requestWindowShutdown).toHaveBeenCalledWith(mocks.installUpdate);
    expect(mocks.installUpdate).not.toHaveBeenCalled();
  });

  it("shows progress only for the currently rendering attempt", () => {
    const { rerender } = renderStatusBar();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();

    mocks.activeAttempt = renderingAttempt();
    rerender(
      <TooltipProvider>
        <StatusBar />
      </TooltipProvider>,
    );

    expect(screen.getByText("clip.mp4")).toBeInTheDocument();
    expect(screen.getByText("42%")).toBeInTheDocument();
    expect(screen.getByText("42f / 100f")).toBeInTheDocument();
  });
});

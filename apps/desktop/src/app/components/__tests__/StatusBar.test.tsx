import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ExportToast } from "@/features/export";
import { TooltipProvider } from "@/components/ui/tooltip";

vi.mock("@/app/update-context", () => ({
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

import { StatusBar } from "../StatusBar";
import { selectStatusBarExport } from "../status-bar-utils";

function exportToast(overrides: Partial<ExportToast>): ExportToast {
  return {
    id: "export-1",
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

  it("shows completed exports as a green full progress indicator and keeps metrics", () => {
    render(
      <TooltipProvider>
        <StatusBar
          queue={[
            exportToast({
              status: "completed",
              progressPercent: 96,
              currentFrame: 4,
              totalFrames: 8,
            }),
          ]}
        />
      </TooltipProvider>,
    );

    const progress = screen.getByRole("progressbar");
    expect(progress).toHaveAttribute("aria-valuenow", "100");
    expect(progress.firstElementChild).toHaveClass("bg-emerald-400");
    expect(screen.getByText("4f / 8f")).toBeInTheDocument();
  });

  it("renders placeholders for metrics that are not available yet", () => {
    render(
      <TooltipProvider>
        <StatusBar queue={[exportToast({})]} />
      </TooltipProvider>,
    );

    expect(screen.getByText("0f / 0f")).toBeInTheDocument();
    expect(screen.getByText("0 FPS")).toBeInTheDocument();
    expect(screen.getByText("0 kbits/s")).toBeInTheDocument();
    expect(screen.getByText("0 MB / 0 MB")).toBeInTheDocument();
    expect(screen.getByText("0:00 / 0:00")).toBeInTheDocument();
  });

  it.each(["failed", "canceled"] as const)(
    "shows %s exports with their last progress and destructive styling",
    (status) => {
      render(
        <TooltipProvider>
          <StatusBar queue={[exportToast({ status, progressPercent: 37 })]} />
        </TooltipProvider>,
      );

      const progress = screen.getByRole("progressbar");
      expect(progress).toHaveAttribute("aria-valuenow", "37");
      expect(progress.firstElementChild).toHaveClass("bg-destructive");
    },
  );
});

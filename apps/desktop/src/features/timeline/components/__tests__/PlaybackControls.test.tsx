import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";

import { FRAME_SHUTTLE_HOLD_DELAY_MS } from "../../lib/editor-shortcuts";
import { PlaybackControls } from "../PlaybackControls";

const mocks = vi.hoisted(() => ({
  playback: {
    isPlaying: false,
    shuttleDirection: 0 as -1 | 0 | 1,
    startShuttle: vi.fn(),
    stepFrame: vi.fn(),
    stopShuttle: vi.fn(),
    toggle: vi.fn(),
    transportError: null as string | null,
  },
  editing: {
    canSetSegmentEnd: true,
    canSetSegmentStart: true,
    onSetSegmentBoundary: vi.fn(),
  },
  readiness: { canInteract: true },
  executeCommand: vi.fn(),
  commands: {
    "previous-marker": { enabled: true, label: "Previous marker", pending: false },
    "next-marker": { enabled: true, label: "Next marker", pending: false },
  },
  timeline: {
    canSetSegmentEnd: true,
    canSetSegmentStart: true,
    onSetSegmentBoundary: vi.fn(),
  },
}));

vi.mock("@/features/timeline", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/timeline")>()),
  useTimelineTransport: () => mocks.playback,
  useTimelineEditing: () => mocks.editing,
  useTimelineReadiness: () => mocks.readiness,
  useTimeline: () => mocks.timeline,
}));

vi.mock("@/app/hooks/useApplicationCommands", () => ({
  useApplicationCommand: (id: keyof typeof mocks.commands) => mocks.commands[id],
  useApplicationCommands: () => ({ executeCommand: mocks.executeCommand }),
}));

vi.mock("@/app/store/redux-hooks", () => ({
  useAppSelector: () => [5_000_000, 15_000_000],
}));

function TestProvider({ children }: { children: ReactNode }) {
  return <TooltipProvider delayDuration={0}>{children}</TooltipProvider>;
}

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("PlaybackControls", () => {
  it("routes trim boundary changes through the timeline contract", async () => {
    render(<PlaybackControls />, { wrapper: TestProvider });

    await userEvent.click(
      screen.getByRole("button", { name: "Set segment start to current position" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Set segment end to current position" }),
    );

    expect(mocks.editing.onSetSegmentBoundary).toHaveBeenNthCalledWith(1, "start", {
      type: "button",
      id: "set-start",
    });
    expect(mocks.editing.onSetSegmentBoundary).toHaveBeenNthCalledWith(2, "end", {
      type: "button",
      id: "set-end",
    });
  });

  it("shows the canonical arrow shortcut separately from the tooltip description", async () => {
    const user = userEvent.setup();
    render(<PlaybackControls />, { wrapper: TestProvider });

    await user.hover(screen.getByRole("button", { name: "Next frame" }));

    expect(await screen.findByText("Next frame")).toBeInTheDocument();
    expect(await screen.findByText("→")).toBeInTheDocument();
  });

  it("steps once on press and starts a held shuttle without a duplicate click", () => {
    vi.useFakeTimers();
    render(<PlaybackControls />, { wrapper: TestProvider });

    const nextFrame = screen.getByRole("button", { name: "Next frame" });
    Object.assign(nextFrame, { setPointerCapture: vi.fn() });

    fireEvent.pointerDown(nextFrame, { button: 0, isPrimary: true, pointerId: 7 });
    expect(mocks.playback.stepFrame).toHaveBeenCalledOnce();
    expect(mocks.playback.stepFrame).toHaveBeenCalledWith(1, {
      type: "button",
      id: "next-frame",
    });

    act(() => vi.advanceTimersByTime(FRAME_SHUTTLE_HOLD_DELAY_MS));
    expect(mocks.playback.startShuttle).toHaveBeenCalledWith(1, {
      type: "button",
      id: "next-frame",
    });

    fireEvent.pointerUp(nextFrame, { button: 0, isPrimary: true, pointerId: 7 });
    fireEvent.click(nextFrame);

    expect(mocks.playback.stopShuttle).toHaveBeenCalledWith({
      type: "button",
      id: "next-frame",
    });
    expect(mocks.playback.stepFrame).toHaveBeenCalledOnce();
  });

  it("keeps a quick pointer press as a single-frame step", () => {
    vi.useFakeTimers();
    render(<PlaybackControls />, { wrapper: TestProvider });

    const previousFrame = screen.getByRole("button", { name: "Previous frame" });
    Object.assign(previousFrame, { setPointerCapture: vi.fn() });

    fireEvent.pointerDown(previousFrame, { button: 0, isPrimary: true, pointerId: 8 });
    fireEvent.pointerUp(previousFrame, { button: 0, isPrimary: true, pointerId: 8 });
    fireEvent.click(previousFrame);
    act(() => vi.advanceTimersByTime(FRAME_SHUTTLE_HOLD_DELAY_MS));

    expect(mocks.playback.stepFrame).toHaveBeenCalledOnce();
    expect(mocks.playback.stepFrame).toHaveBeenCalledWith(-1, {
      type: "button",
      id: "previous-frame",
    });
    expect(mocks.playback.startShuttle).not.toHaveBeenCalled();
    expect(mocks.playback.stopShuttle).not.toHaveBeenCalled();
  });

  it("keeps focus on the current control after clicking a marker navigation button", async () => {
    const user = userEvent.setup();
    render(<PlaybackControls />, { wrapper: TestProvider });

    const playButton = screen.getByRole("button", { name: "Play" });
    const previousMarkerButton = screen.getByRole("button", { name: "Previous marker" });

    const nextMarkerButton = screen.getByRole("button", { name: "Next marker" });
    expect(previousMarkerButton).toHaveAttribute("data-editor-keyboard", "timeline-transport");
    expect(nextMarkerButton).toHaveAttribute("data-editor-keyboard", "timeline-transport");
    expect(screen.getAllByRole("button", { name: /marker/i })).toHaveLength(2);
    playButton.focus();

    await user.click(previousMarkerButton);

    expect(document.activeElement).toBe(playButton);
    expect(mocks.executeCommand).toHaveBeenCalledWith("previous-marker", "button");
  });

  it("hides marker navigation when neither direction has a visible marker target", () => {
    mocks.commands["previous-marker"].enabled = false;
    mocks.commands["next-marker"].enabled = false;
    render(<PlaybackControls />, { wrapper: TestProvider });

    expect(screen.queryByRole("button", { name: /marker/i })).not.toBeInTheDocument();
  });
});

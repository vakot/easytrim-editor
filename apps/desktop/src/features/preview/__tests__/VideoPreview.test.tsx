import { createRef } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { PreviewState } from "@/app/session-state";
import { VideoPreview } from "../VideoPreview";

const callbacks = {
  onPlaybackError: vi.fn(),
  onLoadedMetadata: vi.fn(),
  onCanPlay: vi.fn(),
  onTogglePlayback: vi.fn(),
  onPlay: vi.fn(),
  onPause: vi.fn(),
  onTimeUpdate: vi.fn(),
  onEnded: vi.fn(),
};

function readyPreview(url: string): PreviewState {
  return {
    status: "ready",
    value: { sourceId: "source-1", url, kind: "proxy" },
  };
}

beforeAll(() => {
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
});

afterAll(() => {
  vi.restoreAllMocks();
});

describe("VideoPreview", () => {
  it("renders the empty preview when no source is loaded", () => {
    const videoRef = createRef<HTMLVideoElement>();
    render(
      <VideoPreview
        sourceId={null}
        preview={{ status: "idle" }}
        playbackRate={1}
        muted
        videoRef={videoRef}
        {...callbacks}
      />,
    );

    expect(screen.getByRole("region", { name: "Empty preview" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(6);
    expect(screen.getByText("Open File")).toBeInTheDocument();
    expect(screen.getByText("Support on Ko-fi.com")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /resize crop/i })).not.toBeInTheDocument();
  });

  it("shows the delayed crop hint at the pointer position and hides it when crop opens", () => {
    vi.useFakeTimers();
    try {
      const videoRef = createRef<HTMLVideoElement>();
      const { container } = render(
        <VideoPreview
          sourceId="source-1"
          preview={readyPreview("easytrim-media://preview-1")}
          playbackRate={1}
          muted
          videoRef={videoRef}
          {...callbacks}
        />,
      );
      const viewport = container.querySelector("[data-preview-kind]")?.parentElement?.parentElement;
      expect(viewport).not.toBeNull();
      const affordance = container.querySelector("[data-crop-preview-affordance]");
      expect(affordance).toBeInTheDocument();
      expect(affordance).toHaveClass("group-focus-visible:opacity-100");

      fireEvent.pointerEnter(viewport!, { clientX: 30, clientY: 50 });
      expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
      act(() => vi.advanceTimersByTime(500));
      expect(screen.getByRole("tooltip")).toHaveStyle({ left: "42px", top: "62px" });

      fireEvent.click(viewport!);
      expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
      expect(container.querySelector("[data-crop-preview-affordance]")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps crop controls open after a drag and closes them outside the selection", () => {
    const videoRef = createRef<HTMLVideoElement>();
    const { container } = render(
      <VideoPreview
        sourceId="source-1"
        preview={readyPreview("easytrim-media://preview-1")}
        playbackRate={1}
        muted
        videoRef={videoRef}
        {...callbacks}
      />,
    );

    const viewport = container.querySelector("[data-preview-kind]")?.parentElement?.parentElement;
    expect(viewport).not.toBeNull();
    expect(viewport).toHaveClass("overflow-hidden");
    expect(
      screen.queryByRole("button", { name: "Resize crop from top left" }),
    ).not.toBeInTheDocument();
    fireEvent.pointerDown(viewport!);
    fireEvent.click(viewport!);
    expect(viewport).toHaveClass("overflow-visible");
    const handle = screen.getByRole("button", { name: "Resize crop from top left" });
    expect(handle).toBeVisible();
    expect(screen.getAllByRole("button", { name: /resize crop from/i })).toHaveLength(8);
    expect(container.querySelector("[data-crop-rule-of-thirds]")).not.toBeInTheDocument();
    expect(container.querySelectorAll('[data-crop-snap-marker="top"]')).toHaveLength(5);
    expect(container.querySelectorAll('[data-crop-snap-marker="left"]')).toHaveLength(5);
    expect(container.querySelectorAll('[data-crop-snap-label="top"]')).toHaveLength(5);
    expect(container.querySelectorAll('[data-crop-snap-label="left"]')).toHaveLength(5);
    expect(container.querySelector('[data-crop-snap-marker="top"]')).toHaveClass("h-2");
    expect(container.querySelector('[data-crop-snap-marker="left"]')).toHaveClass("w-2");
    expect(container.querySelector("[data-preview-kind]")?.parentElement).toHaveClass(
      "transition-[width,height,left,top]",
    );
    fireEvent.pointerDown(handle, { pointerId: 1, clientX: 0, clientY: 0 });
    expect(container.querySelector("[data-crop-rule-of-thirds]")?.parentElement).toHaveClass(
      "border-primary",
    );
    expect(container.querySelector('[data-crop-guide="vertical"]')).toBeInTheDocument();
    expect(container.querySelector('[data-crop-guide="horizontal"]')).toBeInTheDocument();
    expect(container.querySelector("[data-crop-rule-of-thirds]")).toHaveClass(
      "mix-blend-difference",
    );
    fireEvent.pointerUp(viewport!, { pointerId: 1, clientX: 0, clientY: 0 });
    expect(container.querySelector("[data-crop-rule-of-thirds]")).not.toBeInTheDocument();
    expect(handle).toBeVisible();

    fireEvent.pointerDown(viewport!);
    fireEvent.click(viewport!);
    expect(
      screen.queryByRole("button", { name: "Resize crop from top left" }),
    ).not.toBeInTheDocument();
  });

  it("pauses playback while crop controls are open", () => {
    const videoRef = createRef<HTMLVideoElement>();
    const { container } = render(
      <VideoPreview
        sourceId="source-1"
        preview={readyPreview("easytrim-media://preview-1")}
        playbackRate={1}
        muted
        videoRef={videoRef}
        {...callbacks}
      />,
    );
    const viewport = container.querySelector("[data-preview-kind]")?.parentElement?.parentElement;
    const video = container.querySelector("video");
    expect(viewport).not.toBeNull();
    expect(video).not.toBeNull();
    const pause = vi.spyOn(video!, "pause").mockImplementation(() => undefined);
    pause.mockClear();

    fireEvent.click(viewport!);
    expect(pause).toHaveBeenCalledTimes(1);

    fireEvent.play(video!);
    expect(pause).toHaveBeenCalledTimes(2);
  });

  it("opens and closes crop controls with Enter or Space when the preview is focused", () => {
    const videoRef = createRef<HTMLVideoElement>();
    const { container } = render(
      <VideoPreview
        sourceId="source-1"
        preview={readyPreview("easytrim-media://preview-1")}
        playbackRate={1}
        muted
        videoRef={videoRef}
        {...callbacks}
      />,
    );
    const viewport = container.querySelector("[aria-label='Video crop preview']");
    expect(viewport).not.toBeNull();

    fireEvent.keyDown(viewport!, { key: "Enter" });
    expect(screen.getByRole("button", { name: "Resize crop from top left" })).toBeVisible();

    fireEvent.keyDown(viewport!, { key: " " });
    expect(
      screen.queryByRole("button", { name: "Resize crop from top left" }),
    ).not.toBeInTheDocument();
  });

  it("closes crop controls with Escape or when focus leaves the preview", () => {
    const videoRef = createRef<HTMLVideoElement>();
    const { container } = render(
      <VideoPreview
        sourceId="source-1"
        preview={readyPreview("easytrim-media://preview-1")}
        playbackRate={1}
        muted
        videoRef={videoRef}
        {...callbacks}
      />,
    );
    const viewport = container.querySelector("[data-preview-kind]")?.parentElement?.parentElement;
    expect(viewport).not.toBeNull();

    fireEvent.click(viewport!);
    fireEvent.keyDown(viewport!, { key: "Escape" });
    expect(
      screen.queryByRole("button", { name: "Resize crop from top left" }),
    ).not.toBeInTheDocument();

    fireEvent.click(viewport!);
    fireEvent.blur(viewport!, { relatedTarget: document.body });
    expect(
      screen.queryByRole("button", { name: "Resize crop from top left" }),
    ).not.toBeInTheDocument();
  });

  it("keeps native audio muted when the preview element is replaced", () => {
    const videoRef = createRef<HTMLVideoElement>();
    const { container, rerender } = render(
      <VideoPreview
        sourceId="source-1"
        preview={readyPreview("easytrim-media://preview-1")}
        playbackRate={1}
        muted
        videoRef={videoRef}
        {...callbacks}
      />,
    );
    const firstVideo = container.querySelector("video");
    expect(firstVideo).toHaveProperty("muted", true);

    rerender(
      <VideoPreview
        sourceId="source-1"
        preview={readyPreview("easytrim-media://preview-2")}
        playbackRate={1}
        muted
        videoRef={videoRef}
        {...callbacks}
      />,
    );
    const replacementVideo = container.querySelector("video");
    expect(replacementVideo).not.toBe(firstVideo);
    expect(replacementVideo).toHaveProperty("muted", true);
  });
});

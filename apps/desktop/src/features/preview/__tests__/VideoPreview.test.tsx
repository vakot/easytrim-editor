import { createRef } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { PreviewState } from "@/app/session-state";
import { VideoPreview } from "../VideoPreview";

const callbacks = {
  onPlaybackError: vi.fn(),
  onLoadedMetadata: vi.fn(),
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

describe("VideoPreview", () => {
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
      expect(container.querySelector("[data-crop-preview-affordance]")).toBeInTheDocument();

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

  it("opens crop resize handles on click and closes them after a drag", () => {
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
    expect(
      screen.queryByRole("button", { name: "Resize crop from top left" }),
    ).not.toBeInTheDocument();
    fireEvent.click(viewport!);
    const handle = screen.getByRole("button", { name: "Resize crop from top left" });
    expect(handle).toBeVisible();

    fireEvent.pointerDown(handle, { pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerUp(viewport!, { pointerId: 1, clientX: 0, clientY: 0 });
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

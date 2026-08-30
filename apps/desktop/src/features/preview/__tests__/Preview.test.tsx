import { act, fireEvent, render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { afterEach, describe, expect, it, vi } from "vitest";

import { sourceSelected } from "@/app/store/actions/source-actions";
import { selectSourceSelection } from "@/app/store/slices/source-slice";
import { createAppStore } from "@/app/store/store";

const playback = vi.hoisted(() => ({
  audioPlayheadRef: { current: null },
  canInteract: false,
  displayedPlayheadMicros: 0,
  isPlaying: false,
  isReady: false,
  nativeLoopEnabled: false,
  onCanPlay: vi.fn(),
  onCropToolOpenChange: vi.fn(),
  onEnded: vi.fn(),
  onLoadedMetadata: vi.fn(),
  onPause: vi.fn(),
  onPlay: vi.fn(),
  onPlaybackError: vi.fn(),
  onScrub: vi.fn(),
  onScrubEnd: vi.fn(),
  onScrubStart: vi.fn(),
  onStepFrame: vi.fn(),
  onTimeUpdate: vi.fn(),
  onTogglePlayback: vi.fn(),
  setSegmentBoundary: vi.fn(),
  stepFrame: vi.fn(),
  toggle: vi.fn(),
  transportError: null,
  videoMuted: false,
  videoRef: { current: null },
}));

vi.mock("@/app/hooks/usePlayback", () => ({
  usePlayback: () => playback,
}));

import { Preview } from "../Preview";

afterEach(() => {
  vi.useRealTimers();
});

describe("Preview", () => {
  it("contains source loading within the preview panel", () => {
    const appStore = createAppStore();
    appStore.dispatch(
      sourceSelected({
        loadToken: 1,
        source: { displayName: "first.mp4", sourcePath: "C:/Media/first.mp4" },
      }),
    );
    const { container } = render(
      <Provider store={appStore}>
        <Preview />
      </Provider>,
    );

    const previewContent = container.querySelector('[data-slot="preview-content"]');
    const loadingOverlay = screen.getByTestId("preview-loading-overlay");

    expect(previewContent).toHaveAttribute("aria-busy", "true");
    expect(previewContent).toHaveClass("relative", "overflow-hidden");
    expect(previewContent).toContainElement(loadingOverlay);
    expect(loadingOverlay).toHaveClass("absolute", "inset-0");
    expect(loadingOverlay).not.toHaveClass("fixed");
    expect(screen.getByText("Opening preview…")).toBeInTheDocument();
    expect(screen.queryByText("Loading…")).not.toBeInTheDocument();
  });

  it("reveals Skip after three seconds and scopes the timer to the current source", () => {
    vi.useFakeTimers();
    const appStore = createAppStore();
    appStore.dispatch(
      sourceSelected({
        loadToken: 1,
        source: { displayName: "first.mp4", sourcePath: "C:/Media/first.mp4" },
      }),
    );
    render(
      <Provider store={appStore}>
        <Preview />
      </Provider>,
    );

    act(() => vi.advanceTimersByTime(2_999));
    expect(screen.queryByRole("button", { name: "Skip" })).not.toBeInTheDocument();

    act(() => {
      appStore.dispatch(
        sourceSelected({
          loadToken: 2,
          source: { displayName: "second.mp4", sourcePath: "C:/Media/second.mp4" },
        }),
      );
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByRole("button", { name: "Skip" })).not.toBeInTheDocument();

    act(() => vi.advanceTimersByTime(3_000));
    const skip = screen.getByRole("button", { name: "Skip" });
    expect(skip).toBeInTheDocument();

    fireEvent.click(skip);
    expect(selectSourceSelection(appStore.getState())).toBeNull();
  });
});

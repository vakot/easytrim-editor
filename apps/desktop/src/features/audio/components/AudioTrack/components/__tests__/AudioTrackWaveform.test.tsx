import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ reducedMotion: false, retry: vi.fn() }));
vi.mock("motion/react", () => ({ useReducedMotion: () => mocks.reducedMotion }));
vi.mock("@/features/audio/hooks/useWaveformPreparation", () => ({
  useWaveformPrepare: () => mocks.retry,
}));

import { TooltipProvider } from "@/components/ui/tooltip";

import { sourceReady, sourceSelected } from "@/app/store/actions/source-actions";
import { useAppSelector } from "@/app/store/redux-hooks";
import {
  audioTrackFiltersApplied,
  waveformDisplayFailed,
  waveformReady,
  waveformsFailed,
  waveformsLoading,
} from "@/app/store/slices/audio-slice";
import { createAppStore } from "@/app/store/store";
import { ThemeProvider } from "@/app/theme/ThemeProvider";
import { firstSource, mediaWithAudio } from "@/test/source.fixtures";

import { AudioTrackWaveform } from "../AudioTrackWaveform";

function envelope(amplitude: number) {
  const buffer = new ArrayBuffer(20);
  const view = new DataView(buffer);
  [0x45, 0x54, 0x57, 0x46].forEach((value, index) => view.setUint8(index, value));
  view.setUint16(4, 2, true);
  view.setUint32(8, 2, true);
  new Uint8Array(buffer, 12).fill(amplitude);
  return buffer;
}
function response(amplitude: number) {
  return { ok: true, arrayBuffer: async () => envelope(amplitude) };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });

  return { promise, resolve };
}

const frames = new Map<number, FrameRequestCallback>();
let nextFrame = 0;
let contexts: Map<HTMLCanvasElement, ReturnType<typeof makeContext>>;
function makeContext() {
  return {
    globalAlpha: 1,
    globalCompositeOperation: "source-over",
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    drawImage: vi.fn(),
    strokes: [] as number[],
    stroke() {
      this.strokes.push(this.globalAlpha);
    },
  };
}
function step(time: number) {
  act(() => {
    const callbacks = [...frames.values()];
    frames.clear();
    callbacks.forEach((callback) => callback(time));
  });
}

beforeEach(() => {
  mocks.reducedMotion = false;
  mocks.retry.mockReset();
  frames.clear();
  nextFrame = 0;
  contexts = new Map();
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.set(++nextFrame, callback);
    return nextFrame;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (
    this: HTMLCanvasElement,
  ) {
    if (!contexts.has(this)) contexts.set(this, makeContext());
    return contexts.get(this) as unknown as CanvasRenderingContext2D;
  });
  vi.spyOn(HTMLCanvasElement.prototype, "getBoundingClientRect").mockReturnValue({
    width: 32,
    height: 50,
  } as DOMRect);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function Harness() {
  const track = useAppSelector((state) => state.audio.tracks[0]);
  const stream = useAppSelector((state) => state.source.media?.audioStreams[0]);
  return track && stream ? (
    <AudioTrackWaveform
      displayMode="peak"
      stream={stream}
      track={track}
      volume={track.processing.volume}
    />
  ) : null;
}
function setup() {
  const store = createAppStore();
  store.dispatch(sourceSelected({ source: firstSource, loadToken: 1 }));
  store.dispatch(sourceReady({ media: mediaWithAudio(firstSource.sourcePath), loadToken: 1 }));
  const view = render(
    <Provider store={store}>
      <ThemeProvider>
        <TooltipProvider>
          <Harness />
        </TooltipProvider>
      </ThemeProvider>
    </Provider>,
  );

  const ready = (jobId: string) =>
    act(() => {
      store.dispatch(waveformsLoading({ jobId, streamIndexes: [2], width: 2 }));
      store.dispatch(
        waveformReady({
          jobId,
          streamIndex: 2,
          status: "ready",
          width: 2,
          url: `media://${jobId}`,
        }),
      );
    });

  return { store, ready, ...view };
}
async function initialWaveform() {
  const fetchMock = vi.fn().mockResolvedValueOnce(response(64));
  vi.stubGlobal("fetch", fetchMock);
  const view = setup();
  view.ready("first");
  await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
  step(0);
  const canvas = document.querySelector("canvas")!;
  return { ...view, fetchMock, canvas, context: contexts.get(canvas)! };
}

describe("waveform replacement", () => {
  it("retains the canvas through regeneration and waits for decoded data before a 250 ms crossfade", async () => {
    const { canvas, context, fetchMock, ready, store } = await initialWaveform();
    act(() =>
      store.dispatch(
        audioTrackFiltersApplied({
          streamIndex: 2,
          filters: [{ enabled: true, id: "g", type: "gain", gainDb: 3 }],
        }),
      ),
    );
    expect(document.querySelector("canvas")).toBe(canvas);
    expect(screen.getByRole("status")).toHaveClass("pointer-events-none");
    const decoded = deferred<ArrayBuffer>();
    fetchMock.mockResolvedValueOnce({ ok: true, arrayBuffer: () => decoded.promise });
    ready("second");
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(context.drawImage).not.toHaveBeenCalled();
    await act(async () => decoded.resolve(envelope(192)));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(document.querySelector("canvas")).toBe(canvas);
    step(100);
    expect(context.strokes.at(-1)).toBe(0);
    step(225);
    expect(context.strokes.at(-1)).toBeCloseTo(0.5);
    step(350);
    expect(context.strokes.at(-1)).toBe(1);
    expect(frames.size).toBe(0);
  });

  it("aborts superseded fetches and ignores stale decode results and stale failure actions", async () => {
    const { context, fetchMock, ready, store } = await initialWaveform();
    const stale = deferred<ArrayBuffer>();
    fetchMock.mockResolvedValueOnce({ ok: true, arrayBuffer: () => stale.promise });
    ready("stale");
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    fetchMock.mockResolvedValueOnce(response(128));
    ready("newest");
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
    expect(fetchMock.mock.calls[1]![1].signal.aborted).toBe(true);
    step(0);
    step(250);
    const strokes = context.strokes.length;
    await act(async () => stale.resolve(new ArrayBuffer(1)));
    act(() =>
      store.dispatch(
        waveformDisplayFailed({ streamIndex: 2, jobId: "stale", url: "media://stale" }),
      ),
    );
    expect(context.strokes).toHaveLength(strokes);
    expect(store.getState().audio.tracks[0]?.waveform).toMatchObject({
      status: "ready",
      jobId: "newest",
    });
  });

  it.each(["generation", "decode"])(
    "preserves the previous image on %s failure and exposes retry",
    async (failure) => {
      const { canvas, context, fetchMock, ready, store } = await initialWaveform();
      if (failure === "generation") {
        act(() => {
          store.dispatch(waveformsLoading({ jobId: "failed", streamIndexes: [2], width: 2 }));
          store.dispatch(
            waveformsFailed({
              jobId: "failed",
              streamIndexes: [2],
              width: 2,
              error: {
                code: "waveform_failed",
                messageId: "media.waveform.previewCouldNotBeDisplayed",
              },
            }),
          );
        });
      } else {
        fetchMock.mockResolvedValueOnce({ ok: true, arrayBuffer: async () => new ArrayBuffer(1) });
        ready("failed");
      }
      await waitFor(() =>
        expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument(),
      );
      expect(document.querySelector("canvas")).toBe(canvas);
      expect(context.drawImage).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole("button", { name: "Retry" }));
      expect(mocks.retry).toHaveBeenCalledOnce();
      fetchMock.mockResolvedValueOnce(response(192));
      ready("retry");
      await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
      step(0);
      step(250);
      expect(context.strokes.at(-1)).toBe(1);
    },
  );

  it("rebases an interrupted fade on the visible composite with a single animation loop", async () => {
    const { canvas, context, fetchMock, ready } = await initialWaveform();
    fetchMock.mockResolvedValueOnce(response(128));
    ready("second");
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
    step(0);
    step(100);
    expect(context.strokes.at(-1)).toBeCloseTo(0.4);
    fetchMock.mockResolvedValueOnce(response(192));
    ready("third");
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
    expect(frames.size).toBe(1);
    const snapshot = [...contexts.entries()].at(-1)!;
    expect(snapshot[0]).not.toBe(canvas);
    expect(snapshot[1].drawImage).toHaveBeenCalledWith(canvas, 0, 0);
    step(100);
    step(350);
    expect(context.strokes.at(-1)).toBe(1);
    expect(frames.size).toBe(0);
  });

  it("switches immediately after decoding when reduced motion is requested", async () => {
    mocks.reducedMotion = true;
    const { context, fetchMock, ready } = await initialWaveform();
    fetchMock.mockResolvedValueOnce(response(192));
    ready("second");
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
    expect(context.drawImage).not.toHaveBeenCalled();
    expect(context.strokes.at(-1)).toBe(1);
    expect(frames.size).toBe(0);
  });

  it("drops the previous canvas and pending fetch when the source activation changes", async () => {
    const { canvas, fetchMock, ready, store, unmount } = await initialWaveform();
    const stale = deferred<ArrayBuffer>();
    fetchMock.mockResolvedValueOnce({ ok: true, arrayBuffer: () => stale.promise });
    ready("pending");
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    act(() => {
      store.dispatch(sourceSelected({ source: firstSource, loadToken: 2 }));
      store.dispatch(sourceReady({ media: mediaWithAudio(firstSource.sourcePath), loadToken: 2 }));
    });
    expect(document.querySelector("canvas")).not.toBe(canvas);
    expect(fetchMock.mock.calls[1]![1].signal.aborted).toBe(true);
    await act(async () => stale.resolve(envelope(255)));
    expect(screen.getByRole("status")).toBeInTheDocument();
    unmount();
    expect(frames.size).toBe(0);
  });

  describe("states", () => {
    const failure = {
      code: "waveform_failed",
      messageId: "media.waveform.previewCouldNotBeDisplayed",
    } as const;

    const fail = (store: ReturnType<typeof setup>["store"], jobId: string) =>
      act(() => {
        store.dispatch(waveformsFailed({ jobId, streamIndexes: [2], width: 2, error: failure }));
      });

    const apply = (store: ReturnType<typeof setup>["store"]) =>
      act(() => {
        store.dispatch(
          audioTrackFiltersApplied({
            streamIndex: 2,
            filters: [{ enabled: true, id: "g", type: "gain", gainDb: 3 }],
          }),
        );
        store.dispatch(waveformsLoading({ jobId: "next", streamIndexes: [2], width: 2 }));
      });

    it("shows a ready waveform without any overlay", async () => {
      const { canvas } = await initialWaveform();
      expect(canvas).toHaveAttribute("data-outdated", "false");
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
      expect(screen.queryByTestId("waveform-shimmer")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
    });

    it("keeps the previous waveform under a shimmer and a centered status while generating", async () => {
      const { canvas, store } = await initialWaveform();
      apply(store);

      expect(document.querySelector("canvas")).toBe(canvas);
      expect(canvas).toHaveAttribute("data-outdated", "false");
      const status = screen.getByRole("status");
      expect(status).toHaveTextContent("Preparing waveform…");
      expect(status).toHaveClass("inset-0", "place-items-center", "pointer-events-none");
      expect(status).not.toHaveClass("top-1", "left-1");
      const shimmer = screen.getByTestId("waveform-shimmer");
      expect(shimmer).toHaveClass("pointer-events-none");
      expect(shimmer.firstElementChild).toHaveClass("animate-waveform-shimmer");
    });

    it("uses a static tint instead of motion when reduced motion is requested", async () => {
      mocks.reducedMotion = true;
      const { store } = await initialWaveform();
      apply(store);

      const shimmer = screen.getByTestId("waveform-shimmer");
      expect(shimmer).toHaveClass("bg-foreground/5");
      expect(shimmer.firstElementChild).toBeNull();
    });

    it("presents the initial generation exactly like a regeneration", async () => {
      vi.stubGlobal("fetch", vi.fn());
      const initial = setup();
      act(() => {
        initial.store.dispatch(waveformsLoading({ jobId: "first", streamIndexes: [2], width: 2 }));
      });
      const initialStatus = screen.getByRole("status");
      const initialShimmer = screen.getByTestId("waveform-shimmer");
      expect(initialStatus).toHaveClass("inset-0", "place-items-center", "pointer-events-none");
      expect(initialStatus.querySelector("svg")).toBeInTheDocument();
      const initialMarkup = [initialStatus.outerHTML, initialShimmer.outerHTML];
      initial.unmount();

      const regeneration = await initialWaveform();
      apply(regeneration.store);
      expect([
        screen.getByRole("status").outerHTML,
        screen.getByTestId("waveform-shimmer").outerHTML,
      ]).toEqual(initialMarkup);
    });

    it("uses the static tint for an initial generation when reduced motion is requested", () => {
      mocks.reducedMotion = true;
      vi.stubGlobal("fetch", vi.fn());
      setup();
      const shimmer = screen.getByTestId("waveform-shimmer");
      expect(shimmer).toHaveClass("bg-foreground/5");
      expect(shimmer.firstElementChild).toBeNull();
    });

    it("presents a failed initial generation like a failed regeneration, without a waveform beneath", async () => {
      vi.stubGlobal("fetch", vi.fn());
      const initial = setup();
      act(() => {
        initial.store.dispatch(waveformsLoading({ jobId: "first", streamIndexes: [2], width: 2 }));
      });
      fail(initial.store, "first");
      const overlay = document.querySelector("[data-slot='audio-track-waveform-status']")!;
      expect(overlay).toHaveTextContent("Waveform unavailable");
      expect(document.querySelector("canvas")).toHaveAttribute("data-outdated", "false");
      expect(screen.queryByTestId("waveform-shimmer")).not.toBeInTheDocument();
      const initialMarkup = overlay.outerHTML;
      initial.unmount();

      const regeneration = await initialWaveform();
      apply(regeneration.store);
      fail(regeneration.store, "next");
      const regenerationOverlay = document.querySelector(
        "[data-slot='audio-track-waveform-status']",
      )!;

      expect(regenerationOverlay).toHaveTextContent("Waveform outdated");
      // Only the wording differs: layout, icon, tooltip trigger, and Retry are identical.
      expect(
        regenerationOverlay.outerHTML.replace("Waveform outdated", "Waveform unavailable"),
      ).toBe(initialMarkup);
    });

    it("keeps the centered status clear of the corner controls", () => {
      vi.stubGlobal("fetch", vi.fn());
      setup();
      expect(screen.getByRole("status")).toHaveClass("px-12");
    });

    it("dims the previous waveform and offers a centered retry when regeneration fails", async () => {
      const { canvas, store } = await initialWaveform();
      apply(store);
      fail(store, "next");

      expect(canvas).toHaveAttribute("data-outdated", "true");
      expect(canvas).toHaveClass("opacity-25", "grayscale");
      expect(canvas).not.toHaveClass("opacity-80");
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
      expect(screen.queryByTestId("waveform-shimmer")).not.toBeInTheDocument();
      expect(screen.getByText("Waveform outdated")).toBeInTheDocument();
      expect(screen.queryByText("Waveform unavailable")).not.toBeInTheDocument();
      // Only the status itself takes pointer input; the rest of the waveform stays interactive.
      const retry = screen.getByRole("button", { name: "Retry" });
      expect(retry.parentElement?.parentElement).toHaveClass(
        "pointer-events-none",
        "inset-0",
        "place-items-center",
      );
      expect(retry.parentElement).toHaveClass("pointer-events-auto");

      fireEvent.focus(screen.getByText("Waveform outdated"));
      expect(
        (await screen.findAllByText("The waveform preview could not be displayed")).length,
      ).toBeGreaterThan(0);
    });

    it("shows an unavailable state with retry when there is no waveform to fall back to", () => {
      vi.stubGlobal("fetch", vi.fn());
      const { store } = setup();
      act(() => {
        store.dispatch(waveformsLoading({ jobId: "first", streamIndexes: [2], width: 2 }));
      });
      fail(store, "first");

      expect(screen.getByText("Waveform unavailable")).toBeInTheDocument();
      expect(screen.queryByText("Waveform outdated")).not.toBeInTheDocument();
      expect(document.querySelector("canvas")).toHaveAttribute("data-outdated", "false");
      expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    });

    it("clears every loading and stale treatment after a successful regeneration", async () => {
      const { canvas, fetchMock, ready, store } = await initialWaveform();
      apply(store);
      fail(store, "next");
      fireEvent.click(screen.getByRole("button", { name: "Retry" }));
      fetchMock.mockResolvedValueOnce(response(192));
      ready("retry");
      await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());

      expect(canvas).toHaveAttribute("data-outdated", "false");
      expect(canvas).toHaveClass("opacity-80");
      expect(screen.queryByTestId("waveform-shimmer")).not.toBeInTheDocument();
      expect(screen.queryByText("Waveform outdated")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
    });

    it("keeps a newer loading state when an older job fails or completes late", async () => {
      const { fetchMock, store } = await initialWaveform();
      apply(store);
      act(() => {
        store.dispatch(waveformsLoading({ jobId: "newest", streamIndexes: [2], width: 2 }));
      });

      fail(store, "next");
      act(() => {
        store.dispatch(
          waveformReady({
            jobId: "next",
            streamIndex: 2,
            status: "ready",
            width: 2,
            url: "media://next",
          }),
        );
      });
      expect(screen.getByRole("status")).toBeInTheDocument();
      expect(screen.getByTestId("waveform-shimmer")).toBeInTheDocument();
      expect(screen.queryByText("Waveform outdated")).not.toBeInTheDocument();
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(store.getState().audio.tracks[0]?.waveform).toMatchObject({
        status: "loading",
        jobId: "newest",
      });
    });

    it("keeps the failure when an older job completes after it", async () => {
      const { canvas, fetchMock, store } = await initialWaveform();
      apply(store);
      fail(store, "next");
      act(() => {
        store.dispatch(
          waveformReady({
            jobId: "older",
            streamIndex: 2,
            status: "ready",
            width: 2,
            url: "media://older",
          }),
        );
      });

      expect(canvas).toHaveAttribute("data-outdated", "true");
      expect(screen.getByText("Waveform outdated")).toBeInTheDocument();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });
});

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";

import { sourceReady, sourceSelected } from "@/app/store/actions/source-actions";
import {
  audioTrackGainChanged,
  audioTrackToggled,
  waveformReady,
  waveformsLoading,
} from "@/app/store/slices/audio-slice";
import { createAppStore } from "@/app/store/store";
import { ThemeProvider } from "@/app/theme/ThemeProvider";
import { useTheme } from "@/app/theme/useTheme";
import { firstSource, mediaWithAudio } from "@/test/source.fixtures";

import { AudioTrackRow } from "../AudioTrack/AudioTrackRow";

const { prepareSourceWaveforms } = vi.hoisted(() => ({ prepareSourceWaveforms: vi.fn() }));

vi.mock("@/app/store/thunks/source-media-thunks", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/app/store/thunks/source-media-thunks")>()),
  prepareSourceWaveforms: (...args: unknown[]) => {
    prepareSourceWaveforms(...args);
    return () => undefined;
  },
}));

afterEach(() => {
  prepareSourceWaveforms.mockReset();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function renderRow({ showColorPreview = false } = {}) {
  const store = createAppStore();
  store.dispatch(sourceSelected({ loadToken: 1, source: firstSource }));
  store.dispatch(sourceReady({ loadToken: 1, media: mediaWithAudio(firstSource.sourcePath) }));

  render(
    <Provider store={store}>
      <ThemeProvider>
        <TooltipProvider>
          {showColorPreview && <PrimaryColorPreviewButton />}
          <AudioTrackRow streamIndex={2} />
        </TooltipProvider>
      </ThemeProvider>
    </Provider>,
  );

  return { store };
}

function PrimaryColorPreviewButton() {
  const { previewPrimaryColor } = useTheme();

  return (
    <button onClick={() => previewPrimaryColor("#123456")} type="button">
      Preview primary color
    </button>
  );
}

/** A two-bin envelope: peak and RMS for the left and right channels of each bin. */
function waveformEnvelope(width: number, value: number) {
  const buffer = new ArrayBuffer(12 + width * 4);
  const view = new DataView(buffer);
  view.setUint8(0, 0x45);
  view.setUint8(1, 0x54);
  view.setUint8(2, 0x57);
  view.setUint8(3, 0x46);
  view.setUint16(4, 2, true);
  view.setUint16(6, 0, true);
  view.setUint32(8, width, true);
  for (let offset = 12; offset < buffer.byteLength; offset += 1) view.setUint8(offset, value);
  return buffer;
}

function mockCanvas({ height = 50, width = 32 } = {}) {
  const moveTo = vi.fn();
  const lineTo = vi.fn();
  const strokeStyle = vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    beginPath: vi.fn(),
    clearRect: vi.fn(),
    lineTo,
    moveTo,
    set lineWidth(_value: number) {},
    set strokeStyle(value: string) {
      strokeStyle(value);
    },
    stroke: vi.fn(),
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, "getBoundingClientRect").mockReturnValue({
    height,
    width,
  } as DOMRect);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  const getMaxHeight = () =>
    Math.max(
      0,
      ...lineTo.mock.calls.map((call, index) => {
        const top = moveTo.mock.calls[index]?.[1] as number;
        return (call[1] as number) - top;
      }),
    );

  return { getMaxHeight, lineTo, strokeStyle };
}

function showWaveform(store: ReturnType<typeof createAppStore>, width = 2) {
  act(() => {
    store.dispatch(waveformsLoading({ jobId: "waveform-1", streamIndexes: [2], width }));
    store.dispatch(
      waveformReady({
        jobId: "waveform-1",
        status: "ready",
        streamIndex: 2,
        url: "media://waveform",
        width,
      }),
    );
  });
}

describe("AudioTrackRow", () => {
  it("shows the waveform as preparing until it is ready", () => {
    renderRow();

    expect(screen.getByRole("status")).toHaveTextContent("Preparing waveform…");
  });

  it("draws the waveform in the live PrimaryColor preview", async () => {
    const { strokeStyle } = mockCanvas();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => waveformEnvelope(2, 128) }),
    );

    const { store } = renderRow({ showColorPreview: true });
    showWaveform(store);

    await waitFor(() => expect(strokeStyle).toHaveBeenCalledWith("rgb(239 191 4)"));
    const canvas = document.querySelector<HTMLCanvasElement>("canvas");
    expect(canvas).toHaveAttribute("aria-hidden", "true");
    expect(canvas).toHaveClass("size-full", "opacity-80");

    fireEvent.click(screen.getByRole("button", { name: /preview primary color/i }));

    await waitFor(() => expect(strokeStyle).toHaveBeenCalledWith("rgb(18 52 86)"));
  });

  it("scales the waveform and its gain badge with the track gain", async () => {
    const { getMaxHeight, lineTo } = mockCanvas();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => waveformEnvelope(2, 64) }),
    );

    const { store } = renderRow();
    showWaveform(store);
    await waitFor(() => expect(lineTo).toHaveBeenCalled());
    const initialHeight = getMaxHeight();

    expect(screen.getByLabelText("Audio 1 gain in decibels")).toHaveTextContent("0.0 dB");

    act(() => store.dispatch(audioTrackGainChanged({ gainDb: 6, streamIndex: 2 })));

    expect(screen.getByLabelText("Audio 1 gain in decibels")).toHaveTextContent("6.0 dB");
    await waitFor(() => expect(getMaxHeight()).toBeGreaterThan(initialHeight));

    const drawnLineCount = lineTo.mock.calls.length;
    act(() => store.dispatch(audioTrackToggled({ streamIndex: 2 })));
    const canvas = document.querySelector<HTMLCanvasElement>("canvas");
    expect(canvas?.parentElement).toHaveAttribute("data-enabled", "false");
    expect(lineTo).toHaveBeenCalledTimes(drawnLineCount);
  });

  it("switches the waveform display between peak, RMS, and stereo", async () => {
    const user = userEvent.setup();
    renderRow();

    const select = screen.getByRole("combobox", { name: "Waveform display" });
    expect(select).toHaveTextContent("Peak");

    await user.click(select);
    await user.click(await screen.findByRole("option", { name: /rms/i }));
    expect(select).toHaveTextContent("RMS");

    await user.click(select);
    await user.click(await screen.findByRole("option", { name: /stereo/i }));
    expect(select).toHaveTextContent("Stereo");
  });

  it("reports an undisplayable waveform and retries it", async () => {
    const user = userEvent.setup();
    mockCanvas();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));

    const { store } = renderRow();
    showWaveform(store, 4096);

    expect(await screen.findByText("Waveform unavailable")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(prepareSourceWaveforms).toHaveBeenCalledWith(firstSource.sourcePath, [2], 4096);
  });
});

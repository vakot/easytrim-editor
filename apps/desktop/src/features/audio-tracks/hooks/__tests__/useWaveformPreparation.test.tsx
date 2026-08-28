import { renderHook } from "@testing-library/react";
import { type PropsWithChildren, StrictMode } from "react";
import { describe, expect, it, vi } from "vitest";

import type { AudioTrackState } from "@/app/store/slices/audio-slice";

import { useWaveformPreparation, WAVEFORM_RENDER_WIDTH } from "../useWaveformPreparation";

const tracks: AudioTrackState[] = [
  { streamIndex: 1, enabled: true, volumePercent: 50, waveform: { status: "idle" } },
  { streamIndex: 2, enabled: true, volumePercent: 50, waveform: { status: "idle" } },
];

function StrictModeWrapper({ children }: PropsWithChildren) {
  return <StrictMode>{children}</StrictMode>;
}

describe("useWaveformPreparation", () => {
  it("requests each pending waveform set once under Strict Mode", () => {
    const prepare = vi.fn();

    renderHook(() => useWaveformPreparation(tracks, true, prepare), {
      wrapper: StrictModeWrapper,
    });

    expect(prepare).toHaveBeenCalledOnce();
    expect(prepare).toHaveBeenCalledWith([1, 2], WAVEFORM_RENDER_WIDTH);
  });

  it("waits for playable media before requesting waveforms", () => {
    const prepare = vi.fn();
    const { rerender } = renderHook(
      ({ enabled }) => useWaveformPreparation(tracks, enabled, prepare),
      { initialProps: { enabled: false } },
    );

    expect(prepare).not.toHaveBeenCalled();

    rerender({ enabled: true });

    expect(prepare).toHaveBeenCalledOnce();
    expect(prepare).toHaveBeenCalledWith([1, 2], WAVEFORM_RENDER_WIDTH);
  });
});

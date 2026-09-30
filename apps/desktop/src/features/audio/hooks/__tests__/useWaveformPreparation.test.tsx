import { renderHook } from "@testing-library/react";
import { type PropsWithChildren, StrictMode } from "react";
import { Provider } from "react-redux";
import { describe, expect, it, vi } from "vitest";

const { prepareSourceWaveforms } = vi.hoisted(() => ({ prepareSourceWaveforms: vi.fn() }));

vi.mock("@/app/hooks/usePlayback", () => ({ usePlayback: () => ({ isReady: true }) }));
vi.mock("@/app/store/thunks/source-media-thunks", () => ({
  prepareSourceWaveforms: (...args: unknown[]) => {
    prepareSourceWaveforms(...args);
    return () => undefined;
  },
}));

import { sourceReady, sourceSelected } from "@/app/store/actions/source-actions";
import { createAppStore } from "@/app/store/store";
import { firstSource, mediaWithAudio } from "@/test/source.fixtures";

import { useWaveformPreparation, WAVEFORM_RENDER_WIDTH } from "../useWaveformPreparation";

describe("useWaveformPreparation", () => {
  it("requests the pending waveform set once under Strict Mode", () => {
    const store = createAppStore({
      getItem: async () => null,
      setItem: async () => undefined,
      removeItem: async () => undefined,
    });

    store.dispatch(sourceSelected({ source: firstSource }));
    store.dispatch(sourceReady({ loadToken: 1, media: mediaWithAudio(firstSource.sourcePath) }));

    renderHook(() => useWaveformPreparation(store.getState().audio.tracks), {
      wrapper: ({ children }: PropsWithChildren) => (
        <StrictMode>
          <Provider store={store}>{children}</Provider>
        </StrictMode>
      ),
    });

    expect(prepareSourceWaveforms).toHaveBeenCalledOnce();
    expect(prepareSourceWaveforms).toHaveBeenCalledWith(
      firstSource.sourcePath,
      [2, 4],
      WAVEFORM_RENDER_WIDTH,
    );
  });
});

import { describe, expect, it } from "vitest";

import { selectedAudioTracks } from "../audio-export";

describe("selectedAudioTracks", () => {
  it("applies master gain to enabled tracks and omits muted audio", () => {
    expect(
      selectedAudioTracks(
        [
          { enabled: true, streamIndex: 1, volumePercent: 50 },
          { enabled: true, streamIndex: 2, volumePercent: 75 },
          { enabled: false, streamIndex: 3, volumePercent: 50 },
          { enabled: true, streamIndex: 4, volumePercent: 0 },
        ],
        { enabled: true, volumePercent: 80 },
      ),
    ).toEqual([
      { streamIndex: 1, volumePercent: 80 },
      { streamIndex: 2, volumePercent: 120 },
    ]);
  });

  it("omits every track when the master output is muted", () => {
    expect(
      selectedAudioTracks([{ enabled: true, streamIndex: 1, volumePercent: 100 }], {
        enabled: false,
        volumePercent: 100,
      }),
    ).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";

import { selectedAudioTracks } from "../audio-export";

describe("selectedAudioTracks", () => {
  it("preserves per-track processing and omits muted tracks", () => {
    expect(
      selectedAudioTracks([
        { enabled: true, streamIndex: 1, processing: { gainDb: -6 } },
        {
          enabled: true,
          streamIndex: 2,
          processing: { gainDb: 2, loudnessNormalization: "streaming" },
        },
        { enabled: false, streamIndex: 3, processing: { gainDb: 0 } },
      ]),
    ).toEqual([
      { streamIndex: 1, processing: { gainDb: -6 } },
      { streamIndex: 2, processing: { gainDb: 2, loudnessNormalization: "streaming" } },
    ]);
  });
});

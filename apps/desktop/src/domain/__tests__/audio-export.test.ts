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

  it("exports same-stage effects in canonical order", () => {
    expect(
      selectedAudioTracks([
        {
          enabled: true,
          streamIndex: 2,
          processing: {
            gainDb: 0,
            effects: [
              { preset: "strong", stage: "cleanup", type: "noiseReduction" },
              { cutoffHz: 120, stage: "cleanup", type: "highPass" },
            ],
          },
        },
      ]),
    ).toEqual([
      {
        streamIndex: 2,
        processing: {
          gainDb: 0,
          effects: [
            { cutoffHz: 120, stage: "cleanup", type: "highPass" },
            { preset: "strong", stage: "cleanup", type: "noiseReduction" },
          ],
        },
      },
    ]);
  });
});

import { describe, expect, it } from "vitest";

import { selectedAudioMetadata, selectedAudioTracks } from "../audio-export";

describe("selectedAudioTracks", () => {
  it("exports each enabled track's ordered chain and Track Volume", () => {
    const filters = [
      { gainDb: 6, id: "pre", type: "gain" as const },
      { cutoffHz: 120, id: "hp", type: "highPass" as const },
      { gainDb: -3, id: "post", type: "gain" as const },
    ];

    expect(
      selectedAudioTracks([
        { enabled: true, streamIndex: 1, metadata: {}, processing: { filters: [], volume: 0.5 } },
        { enabled: true, streamIndex: 2, metadata: {}, processing: { filters, volume: 3 } },
        { enabled: false, streamIndex: 3, metadata: {}, processing: { filters: [], volume: 1 } },
      ]),
    ).toEqual([
      { filters: [], streamIndex: 1, volume: 0.5 },
      { filters, streamIndex: 2, volume: 3 },
    ]);
  });

  it("maps nested output metadata to the native export metadata request", () => {
    expect(
      selectedAudioMetadata([
        {
          enabled: true,
          streamIndex: 2,
          metadata: { isDefault: true, language: "ru", title: "Commentary" },
          processing: { filters: [], volume: 1 },
        },
        {
          enabled: false,
          streamIndex: 4,
          metadata: { isDefault: false, language: "fr", title: "Disabled" },
          processing: { filters: [], volume: 1 },
        },
      ]),
    ).toEqual([{ streamIndex: 2, isDefault: true, language: "rus", title: "Commentary" }]);
  });
});

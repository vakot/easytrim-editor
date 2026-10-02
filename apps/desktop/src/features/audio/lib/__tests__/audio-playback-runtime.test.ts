import { describe, expect, it } from "vitest";

import { getAudioTrackSignalEffect } from "@/domain/audio-processing";

import { getAudioTrackRuntimeLimiter } from "../audio-playback-runtime";

describe("audio playback runtime policy", () => {
  const committed = {
    gainDb: 4,
    effects: [{ ceilingDb: -1, stage: "finalProtection" as const, type: "limiter" as const }],
  };

  const committedLimiter = getAudioTrackSignalEffect(committed, "limiter");

  it("skips a matching ready preview but protects a live gain draft", () => {
    expect(getAudioTrackRuntimeLimiter(committed, committed)).toBeUndefined();
    expect(getAudioTrackRuntimeLimiter(committed, committed, 6)).toEqual(committedLimiter);
  });

  it("compares downstream protection across stale upstream and level changes", () => {
    const staleCurrent = {
      gainDb: 6,
      effects: [
        { cutoffHz: 120, stage: "cleanup" as const, type: "highPass" as const },
        { preset: "medium" as const, stage: "cleanup" as const, type: "noiseReduction" as const },
        { ceilingDb: -1, stage: "finalProtection" as const, type: "limiter" as const },
      ],
    };

    const stalePreview = {
      gainDb: 4,
      effects: [
        { cutoffHz: 80, stage: "cleanup" as const, type: "highPass" as const },
        { ceilingDb: -1, stage: "finalProtection" as const, type: "limiter" as const },
      ],
    };

    expect(
      getAudioTrackRuntimeLimiter({ ...staleCurrent, gainDb: 4 }, stalePreview),
    ).toBeUndefined();
    expect(getAudioTrackRuntimeLimiter(staleCurrent, stalePreview)).toEqual(committedLimiter);
    expect(getAudioTrackRuntimeLimiter(committed, { gainDb: 0 })).toEqual(committedLimiter);
  });

  it("protects a changed Limiter ceiling until the replacement preview is ready", () => {
    const stalePreview = {
      gainDb: 4,
      effects: [{ ceilingDb: -0.5, stage: "finalProtection" as const, type: "limiter" as const }],
    };

    expect(getAudioTrackRuntimeLimiter(committed, stalePreview)).toEqual(committedLimiter);
    expect(getAudioTrackRuntimeLimiter(committed, committed)).toBeUndefined();
  });
});

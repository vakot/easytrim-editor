import { describe, expect, it } from "vitest";

import { getAudioTrackSignalEffect } from "@/domain/audio-processing";

import { getAudioTrackRuntimeLimiter } from "../audio-playback-runtime";

describe("audio playback runtime policy", () => {
  const committed = {
    gainDb: 4,
    effects: [{ ceilingDb: -1, stage: "finalProtection" as const, type: "limiter" as const }],
  };

  const oldPreview = {
    gainDb: 2,
    effects: [{ ceilingDb: -0.5, stage: "finalProtection" as const, type: "limiter" as const }],
  };

  it("does not add a runtime Limiter to a matching ready limited preview", () => {
    expect(
      getAudioTrackRuntimeLimiter(committed, { processing: committed, status: "ready" }),
    ).toBeUndefined();
  });

  it("adds temporary protection for a live gain delta over a limited preview", () => {
    expect(
      getAudioTrackRuntimeLimiter(committed, { processing: committed, status: "ready" }, 6),
    ).toEqual(getAudioTrackSignalEffect(committed, "limiter"));
  });

  it("protects a stale limited preview during regeneration, then removes the runtime Limiter", () => {
    const expectedLimiter = getAudioTrackSignalEffect(committed, "limiter");

    expect(
      getAudioTrackRuntimeLimiter(committed, { processing: oldPreview, status: "stale" }),
    ).toEqual(expectedLimiter);
    expect(
      getAudioTrackRuntimeLimiter(committed, { processing: committed, status: "ready" }),
    ).toBeUndefined();
  });
});

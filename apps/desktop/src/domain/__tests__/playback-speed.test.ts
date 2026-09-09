import { describe, expect, it } from "vitest";

import {
  getPlaybackSpeedStepIndex,
  isAudioPlaybackEnabled,
  MAX_PLAYBACK_SPEED,
  MIN_PLAYBACK_SPEED,
  normalizePlaybackSpeed,
  PLAYBACK_SPEED_STEPS,
} from "@/domain/playback-speed";

describe("playback speed domain", () => {
  it("normalizes numeric speeds to the supported range", () => {
    expect(normalizePlaybackSpeed(MIN_PLAYBACK_SPEED)).toBe(MIN_PLAYBACK_SPEED);
    expect(normalizePlaybackSpeed(12.5)).toBe(12.5);
    expect(normalizePlaybackSpeed(MAX_PLAYBACK_SPEED + 1)).toBe(MAX_PLAYBACK_SPEED);
    expect(normalizePlaybackSpeed(Number.NaN)).toBeNull();
  });

  it("mutes preview audio above five times speed", () => {
    expect(isAudioPlaybackEnabled(5)).toBe(true);
    expect(isAudioPlaybackEnabled(5.01)).toBe(false);
  });

  it("maps typed speeds to the nearest slider variant", () => {
    expect(getPlaybackSpeedStepIndex(0.25)).toBe(0);
    expect(getPlaybackSpeedStepIndex(1.1)).toBe(3);
    expect(getPlaybackSpeedStepIndex(100)).toBe(PLAYBACK_SPEED_STEPS.length - 1);
  });
});

import { describe, expect, it } from "vitest";

import { PLAYING_AUDIO_RESYNC_THRESHOLD_SECONDS, synchronizeAudioPosition } from "../audio-sync";

function audioAt(currentTime: number, seeking = false): HTMLMediaElement {
  return { currentTime, seeking } as HTMLMediaElement;
}

describe("synchronizeAudioPosition", () => {
  it("does not seek through ordinary playback clock jitter", () => {
    const audio = audioAt(10);

    expect(synchronizeAudioPosition(audio, 10.1, false)).toBe(false);
    expect(audio.currentTime).toBe(10);
  });

  it("corrects substantial playback drift", () => {
    const audio = audioAt(10);
    const target = 10 + PLAYING_AUDIO_RESYNC_THRESHOLD_SECONDS;

    expect(synchronizeAudioPosition(audio, target, false)).toBe(true);
    expect(audio.currentTime).toBe(target);
  });

  it("does not restart a correction that is still seeking", () => {
    const audio = audioAt(10, true);

    expect(synchronizeAudioPosition(audio, 11, false)).toBe(false);
    expect(audio.currentTime).toBe(10);
  });

  it("forces exact synchronization before playback starts", () => {
    const audio = audioAt(10);

    expect(synchronizeAudioPosition(audio, 10.01, true)).toBe(true);
    expect(audio.currentTime).toBe(10.01);
  });
});

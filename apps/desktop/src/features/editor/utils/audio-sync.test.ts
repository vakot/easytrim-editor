import { describe, expect, it } from "vitest";

import {
  PLAYING_AUDIO_HARD_RESYNC_THRESHOLD_SECONDS,
  synchronizeAudioPosition,
} from "./audio-sync";

function audioAt(currentTime: number, seeking = false): HTMLMediaElement {
  return { currentTime, seeking, playbackRate: 1 } as HTMLMediaElement;
}

describe("synchronizeAudioPosition", () => {
  it("does not seek through ordinary playback clock jitter", () => {
    const audio = audioAt(10);

    expect(synchronizeAudioPosition(audio, 10.01, 1, false)).toBe("none");
    expect(audio.currentTime).toBe(10);
  });

  it("smoothly corrects moderate playback drift without seeking", () => {
    const audio = audioAt(10);

    expect(synchronizeAudioPosition(audio, 10.06, 1, false)).toBe("rate");
    expect(audio.currentTime).toBe(10);
    expect(audio.playbackRate).toBeGreaterThan(1);
  });

  it("seeks to correct substantial playback drift", () => {
    const audio = audioAt(10);
    const target = 10 + PLAYING_AUDIO_HARD_RESYNC_THRESHOLD_SECONDS + 0.001;

    expect(synchronizeAudioPosition(audio, target, 1, false)).toBe("seek");
    expect(audio.currentTime).toBe(target);
  });

  it("does not restart a correction that is still seeking", () => {
    const audio = audioAt(10, true);

    expect(synchronizeAudioPosition(audio, 11, 1, false)).toBe("none");
    expect(audio.currentTime).toBe(10);
  });

  it("forces exact synchronization before playback starts", () => {
    const audio = audioAt(10);

    expect(synchronizeAudioPosition(audio, 10.01, 1, true)).toBe("seek");
    expect(audio.currentTime).toBe(10.01);
  });
});

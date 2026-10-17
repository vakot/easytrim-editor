/** The two unlock cues: one for every ordinary achievement, one exclusive to secret ones. */
type AchievementSoundKind = "secret" | "standard";

type AchievementSoundHandle = {
  /** Silences the cue and releases its audio nodes; safe to call at any time, any number of times. */
  stop: () => void;
};

type AchievementSoundPlayer = {
  /** Stops anything playing and releases the audio context. */
  dispose: () => void;
  /** Starts a cue without waiting for it; playback problems never throw. */
  play: (kind: AchievementSoundKind) => AchievementSoundHandle;
};

type Voice = {
  /** Seconds after the cue starts. */
  at: number;
  duration: number;
  frequency: number;
  /** Peak gain of this voice before the cue's master level. */
  gain: number;
  type: OscillatorType;
};

type Cue = {
  /** Master level, tuned so every cue peaks at a similar perceived volume. */
  level: number;
  voices: readonly Voice[];
};

const NOTE = {
  B5: 987.77,
  C4: 261.63,
  C5: 523.25,
  C7: 2093,
  D6: 1174.66,
  E5: 659.25,
  E6: 1318.51,
  E7: 2637.02,
  G4: 392,
  G5: 783.99,
  G7: 3135.96,
} as const;

/** A short, clean two-note chime. */
const standardCue: Cue = {
  level: 0.16,
  voices: [
    { at: 0, duration: 0.32, frequency: NOTE.G5, gain: 1, type: "sine" },
    { at: 0.09, duration: 0.42, frequency: NOTE.D6, gain: 0.85, type: "sine" },
  ],
};

/**
 * A layered fanfare: a rising major-seventh arpeggio in triangle and sine, a sustained pad under
 * it, and a few high sparkles on top. Longer and richer than the standard chime.
 */
const secretCue: Cue = {
  level: 0.09,
  voices: [
    { at: 0, duration: 1.3, frequency: NOTE.C4, gain: 0.5, type: "sine" },
    { at: 0, duration: 1.3, frequency: NOTE.G4, gain: 0.4, type: "sine" },
    ...[NOTE.C5, NOTE.E5, NOTE.G5, NOTE.B5, NOTE.E6].flatMap((frequency, index) => [
      { at: index * 0.09, duration: 0.7, frequency, gain: 0.8, type: "triangle" as const },
      {
        at: index * 0.09,
        duration: 0.55,
        frequency: frequency * 2,
        gain: 0.25,
        type: "sine" as const,
      },
    ]),
    { at: 0.6, duration: 0.55, frequency: NOTE.C7, gain: 0.22, type: "sine" },
    { at: 0.68, duration: 0.55, frequency: NOTE.E7, gain: 0.18, type: "sine" },
    { at: 0.76, duration: 0.6, frequency: NOTE.G7, gain: 0.14, type: "sine" },
  ],
};

const cues: Record<AchievementSoundKind, Cue> = { secret: secretCue, standard: standardCue };

const SILENT_FLOOR = 0.0001;
const ATTACK_SECONDS = 0.01;
const STOP_PADDING_SECONDS = 0.05;

const silentHandle: AchievementSoundHandle = { stop: () => undefined };

/** Schedules every voice of a cue on `context` and returns the handle that tears it down. */
function startCue(context: AudioContext, cue: Cue, onFinished: () => void): AchievementSoundHandle {
  const master = context.createGain();
  const voices: { envelope: GainNode | null; oscillator: OscillatorNode }[] = [];

  try {
    master.gain.value = cue.level;
    master.connect(context.destination);

    const start = context.currentTime;
    for (const voice of cue.voices) {
      const oscillator = context.createOscillator();
      const nodes: { envelope: GainNode | null; oscillator: OscillatorNode } = {
        envelope: null,
        oscillator,
      };

      voices.push(nodes);

      const envelope = context.createGain();
      nodes.envelope = envelope;
      const at = start + voice.at;
      const end = at + voice.duration;

      oscillator.type = voice.type;
      oscillator.frequency.value = voice.frequency;
      envelope.gain.setValueAtTime(SILENT_FLOOR, at);
      envelope.gain.linearRampToValueAtTime(voice.gain, at + ATTACK_SECONDS);
      envelope.gain.exponentialRampToValueAtTime(SILENT_FLOOR, end);
      oscillator.connect(envelope);
      envelope.connect(master);
      oscillator.start(at);
      oscillator.stop(end + STOP_PADDING_SECONDS);
    }

    let stopped = false;
    const release = () => {
      if (stopped) return;
      stopped = true;
      for (const { envelope, oscillator } of voices) {
        oscillator.disconnect();
        envelope?.disconnect();
      }
      master.disconnect();
      onFinished();
    };

    // The voices end at different times; the last one to end releases the whole cue.
    const endTimes = cue.voices.map((voice) => voice.at + voice.duration);
    const lastVoice = voices[endTimes.indexOf(Math.max(...endTimes))];
    if (lastVoice) lastVoice.oscillator.onended = release;

    return {
      stop: () => {
        if (stopped) return;
        for (const { oscillator } of voices) {
          try {
            oscillator.stop();
          } catch {
            // A voice that already ended cannot be stopped again.
          }
        }
        release();
      },
    };
  } catch (error) {
    for (const { envelope, oscillator } of voices) {
      try {
        oscillator.stop();
      } catch {
        // An oscillator may not have started before setup failed.
      }
      try {
        oscillator.disconnect();
      } catch {
        // Keep releasing the remaining nodes if one cannot be disconnected.
      }
      try {
        envelope?.disconnect();
      } catch {
        // Keep releasing the remaining nodes if one cannot be disconnected.
      }
    }
    try {
      master.disconnect();
    } catch {
      // Preserve the initialization error after attempting to release the full graph.
    }
    throw error;
  }
}

/**
 * Plays the achievement cues with the Web Audio API, synthesized on demand so no audio files are
 * bundled. The player owns its own audio context, separate from media preview playback, creates it
 * on first use, and closes it when disposed. When audio is unavailable or blocked the cue is simply
 * skipped.
 */
function createAchievementSoundPlayer(
  createContext: () => AudioContext = () => new AudioContext(),
): AchievementSoundPlayer {
  let context: AudioContext | null = null;
  const active = new Set<AchievementSoundHandle>();

  return {
    dispose: () => {
      for (const handle of [...active]) handle.stop();
      const closing = context;
      context = null;
      void closing?.close().catch(() => undefined);
    },
    play: (kind) => {
      try {
        context ??= createContext();
        // Autoplay policies can leave the context suspended until the user interacts; a refused
        // resume only means this cue stays silent.
        if (context.state === "suspended") void context.resume().catch(() => undefined);

        const handle: AchievementSoundHandle = startCue(context, cues[kind], () =>
          active.delete(handle),
        );

        active.add(handle);
        return handle;
      } catch {
        return silentHandle;
      }
    },
  };
}

export { createAchievementSoundPlayer };
export type { AchievementSoundHandle, AchievementSoundKind, AchievementSoundPlayer };

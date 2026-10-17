import { describe, expect, it, vi } from "vitest";

import { createAchievementSoundPlayer } from "../achievement-sound";

function parameter() {
  return {
    exponentialRampToValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    setValueAtTime: vi.fn(),
    value: 0,
  };
}

function createFakeContext(state: AudioContextState = "running") {
  const gains: {
    connect: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    gain: ReturnType<typeof parameter>;
  }[] = [];

  const oscillators: {
    connect: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    frequency: { value: number };
    onended: (() => void) | null;
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
    type: OscillatorType;
  }[] = [];

  const context = {
    close: vi.fn(async () => undefined),
    createGain: vi.fn(() => {
      const gain = { connect: vi.fn(), disconnect: vi.fn(), gain: parameter() };
      gains.push(gain);
      return gain;
    }),
    createOscillator: vi.fn(() => {
      const oscillator = {
        connect: vi.fn(),
        disconnect: vi.fn(),
        frequency: { value: 0 },
        onended: null as (() => void) | null,
        start: vi.fn(),
        stop: vi.fn(),
        type: "sine" as OscillatorType,
      };

      oscillators.push(oscillator);
      return oscillator;
    }),
    currentTime: 10,
    destination: {},
    resume: vi.fn(async () => undefined),
    state,
  };

  return { context: context as unknown as AudioContext, fake: context, gains, oscillators };
}

function endOf(oscillator: { stop: ReturnType<typeof vi.fn> }) {
  return oscillator.stop.mock.calls[0]![0] as number;
}

describe("createAchievementSoundPlayer", () => {
  it("plays a short chime for the standard cue", () => {
    const { context, oscillators } = createFakeContext();
    createAchievementSoundPlayer(() => context).play("standard");

    expect(oscillators).toHaveLength(2);
    expect(oscillators.every((oscillator) => oscillator.start.mock.calls.length === 1)).toBe(true);
    expect(Math.max(...oscillators.map(endOf))).toBeLessThan(10.6);
  });

  it("plays a richer, longer, layered cue for secrets", () => {
    const standard = createFakeContext();
    const secret = createFakeContext();
    createAchievementSoundPlayer(() => standard.context).play("standard");
    createAchievementSoundPlayer(() => secret.context).play("secret");

    expect(secret.oscillators.length).toBeGreaterThan(standard.oscillators.length * 4);
    expect(Math.max(...secret.oscillators.map(endOf))).toBeGreaterThan(
      Math.max(...standard.oscillators.map(endOf)) + 0.8,
    );
    expect(new Set(secret.oscillators.map((oscillator) => oscillator.type)).size).toBeGreaterThan(
      1,
    );
    const standardFrequencies = new Set(
      standard.oscillators.map((oscillator) => oscillator.frequency.value),
    );

    expect(
      secret.oscillators.some((oscillator) => standardFrequencies.has(oscillator.frequency.value)),
    ).toBe(true);
  });

  it("keeps the cues at a comparable peak level", () => {
    const standard = createFakeContext();
    const secret = createFakeContext();
    createAchievementSoundPlayer(() => standard.context).play("standard");
    createAchievementSoundPlayer(() => secret.context).play("secret");

    const level = (gains: { gain: { value: number } }[]) => gains[0]!.gain.value;
    expect(level(standard.gains)).toBeGreaterThan(0);
    expect(level(secret.gains)).toBeGreaterThan(0);
    expect(level(secret.gains) / level(standard.gains)).toBeLessThan(1);
    expect(level(secret.gains) / level(standard.gains)).toBeGreaterThan(0.3);
  });

  it("silences and releases every node when stopped, once", () => {
    const { context, gains, oscillators } = createFakeContext();
    const handle = createAchievementSoundPlayer(() => context).play("secret");

    handle.stop();
    handle.stop();

    for (const oscillator of oscillators) {
      expect(oscillator.stop).toHaveBeenCalledTimes(2);
      expect(oscillator.disconnect).toHaveBeenCalledTimes(1);
    }
    expect(gains.every((gain) => gain.disconnect.mock.calls.length === 1)).toBe(true);
  });

  it("releases the nodes when the last voice ends on its own", () => {
    const { context, gains, oscillators } = createFakeContext();
    createAchievementSoundPlayer(() => context).play("standard");
    const last = oscillators.reduce((latest, oscillator) =>
      endOf(oscillator) > endOf(latest) ? oscillator : latest,
    );

    last.onended?.();

    expect(oscillators.every((oscillator) => oscillator.disconnect.mock.calls.length === 1)).toBe(
      true,
    );
    expect(gains.every((gain) => gain.disconnect.mock.calls.length === 1)).toBe(true);
  });

  it("tolerates voices that cannot be stopped again", () => {
    const { context, oscillators } = createFakeContext();
    const handle = createAchievementSoundPlayer(() => context).play("standard");
    for (const oscillator of oscillators)
      oscillator.stop.mockImplementation(() => {
        throw new Error("ended");
      });

    expect(() => handle.stop()).not.toThrow();
  });

  it("asks a suspended context to resume and survives a refusal", async () => {
    const { context, fake, oscillators } = createFakeContext("suspended");
    fake.resume.mockRejectedValue(new DOMException("blocked", "NotAllowedError"));

    expect(() => createAchievementSoundPlayer(() => context).play("standard")).not.toThrow();
    await Promise.resolve();

    expect(fake.resume).toHaveBeenCalledTimes(1);
    expect(oscillators.length).toBeGreaterThan(0);
  });

  it("stays silent instead of throwing when audio cannot be created or scheduled", () => {
    const unavailable = createAchievementSoundPlayer(() => {
      throw new Error("no audio");
    });

    expect(() => unavailable.play("secret").stop()).not.toThrow();

    const { context, fake } = createFakeContext();
    fake.createOscillator.mockImplementation(() => {
      throw new Error("failed");
    });
    expect(() => createAchievementSoundPlayer(() => context).play("standard")).not.toThrow();
  });

  it("cleans up earlier voices when a later voice fails to initialize", () => {
    const { context, fake, gains, oscillators } = createFakeContext();
    const createOscillator = fake.createOscillator.getMockImplementation()!;
    let createCount = 0;
    fake.createOscillator.mockImplementation(() => {
      createCount += 1;
      if (createCount === 3) throw new Error("later voice failed");
      return createOscillator();
    });

    const player = createAchievementSoundPlayer(() => context);
    expect(() => player.play("secret").stop()).not.toThrow();

    expect(oscillators).toHaveLength(2);
    expect(
      oscillators.every((oscillator) =>
        oscillator.stop.mock.calls.some(([when]) => when === undefined),
      ),
    ).toBe(true);
    expect(oscillators.every((oscillator) => oscillator.disconnect.mock.calls.length === 1)).toBe(
      true,
    );
    expect(gains.every((gain) => gain.disconnect.mock.calls.length === 1)).toBe(true);
  });

  it("creates one context, reuses it, and closes it on dispose after stopping cues", () => {
    const first = createFakeContext();
    const second = createFakeContext();
    const contexts = [first.context, second.context];
    const createContext = vi.fn(() => contexts.shift()!);
    const player = createAchievementSoundPlayer(createContext);

    player.play("standard");
    player.play("secret");
    expect(createContext).toHaveBeenCalledTimes(1);

    player.dispose();
    expect(first.fake.close).toHaveBeenCalledTimes(1);
    expect(
      first.oscillators.every((oscillator) => oscillator.disconnect.mock.calls.length === 1),
    ).toBe(true);

    player.play("standard");
    expect(createContext).toHaveBeenCalledTimes(2);
    expect(second.oscillators.length).toBeGreaterThan(0);
  });
});

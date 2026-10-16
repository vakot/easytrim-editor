import { vi } from "vitest";

function audioParameter(value = 1) {
  return {
    cancelAndHoldAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    setTargetAtTime: vi.fn(),
    setValueAtTime: vi.fn(),
    value,
  };
}

function audioNode() {
  return {
    connect: vi.fn(),
    disconnect: vi.fn(),
    gain: audioParameter(),
  };
}

/** A fake AudioContext whose clock tests set and whose sources and gain nodes they inspect. */
function createFakeAudioContext() {
  const sources: Array<
    ReturnType<typeof audioNode> & {
      buffer: AudioBuffer | null;
      onended: (() => void) | null;
      playbackRate: ReturnType<typeof audioParameter>;
      start: ReturnType<typeof vi.fn>;
      stop: ReturnType<typeof vi.fn>;
    }
  > = [];

  const gains: ReturnType<typeof audioNode>[] = [];
  const buffers: Array<{ channels: Float32Array[]; duration: number }> = [];
  const filters: Array<{
    connect: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    frequency: ReturnType<typeof audioParameter>;
    Q: ReturnType<typeof audioParameter>;
    type: BiquadFilterType;
  }> = [];

  let currentTime = 5;
  const context = {
    destination: audioNode(),
    close: vi.fn(async () => undefined),
    createAnalyser: vi.fn(() => ({
      ...audioNode(),
      fftSize: 2048,
      getFloatTimeDomainData: vi.fn(),
    })),
    createBiquadFilter: vi.fn(() => {
      const filter = {
        connect: vi.fn(),
        disconnect: vi.fn(),
        frequency: audioParameter(0),
        Q: audioParameter(Math.SQRT1_2),
        type: "highpass" as BiquadFilterType,
      };

      filters.push(filter);
      return filter;
    }),
    createBuffer: vi.fn((channelCount: number, frames: number, sampleRate: number) => {
      const audioBuffer = {
        channels: Array.from({ length: channelCount }, () => new Float32Array(frames)),
        duration: frames / sampleRate,
        getChannelData: (channel: number) => audioBuffer.channels[channel]!,
      };

      buffers.push(audioBuffer);
      return audioBuffer;
    }),
    createBufferSource: vi.fn(() => {
      const source = {
        ...audioNode(),
        buffer: null as AudioBuffer | null,
        onended: null as (() => void) | null,
        playbackRate: audioParameter(),
        start: vi.fn(),
        stop: vi.fn(),
      };

      sources.push(source);
      return source;
    }),
    createChannelSplitter: vi.fn(() => ({ ...audioNode(), channelCount: 2 })),
    createGain: vi.fn(() => {
      const gain = audioNode();
      gains.push(gain);
      return gain;
    }),
    resume: vi.fn(async () => undefined),
  } as unknown as AudioContext;

  Object.defineProperty(context, "currentTime", { get: () => currentTime });

  return {
    buffers,
    context,
    gains,
    filters,
    sources,
    setCurrentTime: (nextTime: number) => {
      currentTime = nextTime;
    },
  };
}

export { audioNode, createFakeAudioContext };

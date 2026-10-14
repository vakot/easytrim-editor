import type { AudioTrackHighPass } from "@/domain/audio-processing";

import { createStereoAudioMeterNodes, type StereoAudioMeterNodes } from "./stereo-audio-meter";

const HIGH_PASS_STAGES = ["cleanup", "dynamics", "finalProtection"] as const;
type HighPassStage = (typeof HIGH_PASS_STAGES)[number];

type AudioTrackRuntimeNodes = {
  gain: GainNode;
  highPassFilters: Record<HighPassStage, BiquadFilterNode>;
  input: GainNode;
};

function connectAudioTrackRuntime(
  context: AudioContext,
  audioMix: GainNode,
): AudioTrackRuntimeNodes {
  const input = context.createGain();
  const gain = context.createGain();
  const highPassFilters = {
    cleanup: context.createBiquadFilter(),
    dynamics: context.createBiquadFilter(),
    finalProtection: context.createBiquadFilter(),
  };

  for (const filter of Object.values(highPassFilters)) {
    filter.type = "highpass";
    filter.frequency.value = 0;
    // Match the two-pole Butterworth response used by FFmpeg's highpass filter.
    filter.Q.value = Math.SQRT1_2;
  }

  input.connect(highPassFilters.cleanup);
  highPassFilters.cleanup.connect(highPassFilters.dynamics);
  highPassFilters.dynamics.connect(gain);
  gain.connect(highPassFilters.finalProtection);
  highPassFilters.finalProtection.connect(audioMix);

  return { gain, highPassFilters, input };
}

function updateAudioTrackHighPass(
  context: AudioContext,
  nodes: Pick<AudioTrackRuntimeNodes, "highPassFilters">,
  effects: AudioTrackHighPass[],
): void {
  const effectsByStage = new Map(effects.map((effect) => [effect.stage, effect]));

  for (const stage of HIGH_PASS_STAGES) {
    const effect = effectsByStage.get(stage);
    nodes.highPassFilters[stage].frequency.setTargetAtTime(
      effect?.cutoffHz ?? 0,
      context.currentTime,
      0.015,
    );
  }
}

function disconnectAudioTrackRuntime(nodes: AudioTrackRuntimeNodes): void {
  nodes.input.disconnect();
  nodes.gain.disconnect();
  for (const filter of Object.values(nodes.highPassFilters)) filter.disconnect();
}

function connectPlaybackAudioGraph(
  context: AudioContext,
  audioMix: GainNode,
): { meter: StereoAudioMeterNodes; outputGain: GainNode } {
  const meter = createStereoAudioMeterNodes(context, audioMix);
  const outputGain = context.createGain();
  audioMix.connect(outputGain);
  outputGain.connect(context.destination);
  return { meter, outputGain };
}

export {
  connectAudioTrackRuntime,
  connectPlaybackAudioGraph,
  disconnectAudioTrackRuntime,
  updateAudioTrackHighPass,
};

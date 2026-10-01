import type { AudioTrackState } from "@/app/store/slices/audio-slice";
import { getAudioTrackSignalEffect, limitAudioPreviewSample } from "@/domain/audio-processing";

import { createStereoAudioMeterNodes, type StereoAudioMeterNodes } from "./stereo-audio-meter";

function limiterCurve(ceilingDb: number): Float32Array<ArrayBuffer> {
  const curve: Float32Array<ArrayBuffer> = new Float32Array(
    new ArrayBuffer(4096 * Float32Array.BYTES_PER_ELEMENT),
  );

  for (let index = 0; index < curve.length; index += 1) {
    const sample = (index / (curve.length - 1)) * 2 - 1;
    curve[index] = limitAudioPreviewSample(sample, ceilingDb);
  }
  return curve;
}

function connectAudioTrackLimiter(
  context: AudioContext,
  gain: GainNode,
  audioMix: GainNode,
  track: AudioTrackState,
): WaveShaperNode | null {
  const limiter = getAudioTrackSignalEffect(track.processing, "limiter");
  if (!limiter) return null;
  const node = context.createWaveShaper();
  node.curve = limiterCurve(limiter.ceilingDb);
  node.oversample = "4x";
  gain.connect(node).connect(audioMix);
  return node;
}

function updateAudioTrackLimiter(
  context: AudioContext,
  nodes: { gain: GainNode; limiter: WaveShaperNode | null },
  audioMix: GainNode,
  track: AudioTrackState,
): void {
  const limiter = getAudioTrackSignalEffect(track.processing, "limiter");
  if (!limiter) {
    if (nodes.limiter) {
      nodes.limiter.disconnect();
      nodes.limiter = null;
      nodes.gain.connect(audioMix);
    }
    return;
  }

  if (nodes.limiter) {
    nodes.limiter.curve = limiterCurve(limiter.ceilingDb);
    return;
  }

  const node = context.createWaveShaper();
  node.curve = limiterCurve(limiter.ceilingDb);
  node.oversample = "4x";
  nodes.gain.disconnect();
  nodes.gain.connect(node).connect(audioMix);
  nodes.limiter = node;
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

export { connectAudioTrackLimiter, connectPlaybackAudioGraph, updateAudioTrackLimiter };

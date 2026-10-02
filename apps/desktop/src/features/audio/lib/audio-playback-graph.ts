import { type AudioTrackLimiter, limitAudioPreviewSample } from "@/domain/audio-processing";

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

function updateAudioTrackLimiter(
  context: AudioContext,
  nodes: { gain: GainNode; limiter: WaveShaperNode | null },
  audioMix: GainNode,
  limiter: AudioTrackLimiter | undefined,
): void {
  if (!limiter) {
    if (nodes.limiter) {
      nodes.gain.disconnect();
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
  nodes.gain.connect(node);
  node.connect(audioMix);
  nodes.limiter = node;
}

function disconnectAudioTrackRuntime(nodes: {
  gain: GainNode;
  limiter: WaveShaperNode | null;
  source: MediaElementAudioSourceNode;
}): void {
  nodes.source.disconnect();
  nodes.gain.disconnect();
  nodes.limiter?.disconnect();
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

export { connectPlaybackAudioGraph, disconnectAudioTrackRuntime, updateAudioTrackLimiter };

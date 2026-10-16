import { createStereoAudioMeterNodes, type StereoAudioMeterNodes } from "./stereo-audio-meter";

type AudioTrackRuntimeNodes = {
  gain: GainNode;
  input: GainNode;
};

/** Processed track PCM enters `input`; `gain` applies Track Volume before the mix. */
function connectAudioTrackRuntime(
  context: AudioContext,
  audioMix: GainNode,
): AudioTrackRuntimeNodes {
  const input = context.createGain();
  const gain = context.createGain();
  input.connect(gain);
  gain.connect(audioMix);
  return { gain, input };
}

function disconnectAudioTrackRuntime(nodes: AudioTrackRuntimeNodes): void {
  nodes.input.disconnect();
  nodes.gain.disconnect();
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

export { connectAudioTrackRuntime, connectPlaybackAudioGraph, disconnectAudioTrackRuntime };

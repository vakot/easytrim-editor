const METER_FLOOR_DB = -60;
const METER_DECAY_TIME_MS = 240;
const METER_SILENCE_LEVEL = 0.001;

interface StereoAudioMeterNodes {
  left: AnalyserNode;
  right: AnalyserNode;
  source: AudioNode;
  splitter: ChannelSplitterNode;
}

function createStereoAudioMeterNodes(
  context: AudioContext,
  source: AudioNode,
): StereoAudioMeterNodes {
  const splitter = context.createChannelSplitter(2);
  const left = context.createAnalyser();
  const right = context.createAnalyser();
  left.fftSize = 2048;
  right.fftSize = 2048;
  source.connect(splitter);
  splitter.connect(left, 0);
  splitter.connect(right, 1);
  return { left, right, splitter, source };
}

function disconnectStereoAudioMeterNodes(meter: StereoAudioMeterNodes | null): void {
  if (!meter) return;
  meter.source.disconnect(meter.splitter);
  meter.splitter.disconnect();
  meter.left.disconnect();
  meter.right.disconnect();
}

function peakAmplitude(samples: Float32Array): number {
  let peak = 0;
  for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
  return peak;
}

function amplitudeToMeterLevel(amplitude: number): number {
  if (!Number.isFinite(amplitude) || amplitude <= 0) return 0;
  const db = 20 * Math.log10(amplitude);
  return Math.max(0, Math.min(1, (db - METER_FLOOR_DB) / -METER_FLOOR_DB));
}

function smoothMeterLevel(current: number, target: number, elapsedMs: number): number {
  const boundedTarget = Math.max(0, Math.min(1, target));
  if (boundedTarget >= current) return boundedTarget;
  const decay = Math.exp(-Math.max(0, elapsedMs) / METER_DECAY_TIME_MS);
  const next = boundedTarget + (current - boundedTarget) * decay;
  return next < METER_SILENCE_LEVEL ? 0 : next;
}

export {
  amplitudeToMeterLevel,
  createStereoAudioMeterNodes,
  disconnectStereoAudioMeterNodes,
  peakAmplitude,
  smoothMeterLevel,
};

export type { StereoAudioMeterNodes };

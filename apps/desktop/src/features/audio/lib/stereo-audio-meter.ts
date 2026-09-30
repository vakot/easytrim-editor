const METER_FLOOR_DB = -60;
const METER_DECAY_TIME_MS = 240;
const METER_SILENCE_LEVEL = 0.001;
const PEAK_HOLD_DURATION_MS = 750;
const PEAK_HOLD_RELEASE_DURATION_MS = 900;
const METER_SAFE_ZONE_END = 2 / 3;
const METER_WARNING_ZONE_END = 0.85;

interface MeterZoneLevels {
  clipping: number;
  safe: number;
  warning: number;
}

interface PeakHoldState {
  holdRemainingMs: number;
  level: number;
}

interface StereoAudioMeterNodes {
  isMono: boolean;
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
  return { left, isMono: false, right, splitter, source };
}

function disconnectStereoAudioMeterNodes(meter: StereoAudioMeterNodes | null): void {
  if (!meter) return;
  meter.source.disconnect(meter.splitter);
  meter.splitter.disconnect();
  meter.left.disconnect();
  meter.right.disconnect();
}

function isMonoAudioMix(channelCounts: readonly (number | undefined)[]): boolean {
  return channelCounts.length > 0 && channelCounts.every((channelCount) => channelCount === 1);
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

function meterZoneLevels(level: number): MeterZoneLevels {
  const boundedLevel = Math.max(0, Math.min(1, level));
  return {
    clipping: Math.max(0, boundedLevel - METER_WARNING_ZONE_END),
    safe: Math.min(boundedLevel, METER_SAFE_ZONE_END),
    warning: Math.max(0, Math.min(boundedLevel, METER_WARNING_ZONE_END) - METER_SAFE_ZONE_END),
  };
}

function updatePeakHold(
  current: PeakHoldState,
  liveLevel: number,
  elapsedMs: number,
): PeakHoldState {
  const boundedLiveLevel = Math.max(0, Math.min(1, liveLevel));
  if (boundedLiveLevel > current.level) {
    return { level: boundedLiveLevel, holdRemainingMs: PEAK_HOLD_DURATION_MS };
  }

  const elapsed = Math.max(0, elapsedMs);
  const heldTime = Math.min(elapsed, current.holdRemainingMs);
  const holdRemainingMs = Math.max(0, current.holdRemainingMs - elapsed);
  const releaseTime = elapsed - heldTime;
  if (releaseTime === 0) return { ...current, holdRemainingMs };

  const level = Math.max(
    boundedLiveLevel,
    current.level - releaseTime / PEAK_HOLD_RELEASE_DURATION_MS,
  );

  return {
    level: level - boundedLiveLevel < METER_SILENCE_LEVEL ? boundedLiveLevel : level,
    holdRemainingMs,
  };
}

export {
  amplitudeToMeterLevel,
  createStereoAudioMeterNodes,
  disconnectStereoAudioMeterNodes,
  isMonoAudioMix,
  meterZoneLevels,
  peakAmplitude,
  smoothMeterLevel,
  updatePeakHold,
};

export type { MeterZoneLevels, PeakHoldState, StereoAudioMeterNodes };

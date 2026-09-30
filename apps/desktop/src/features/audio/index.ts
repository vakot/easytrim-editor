export { AudioPanel } from "./components/AudioPanel";
export { synchronizeAudioPosition } from "./lib/audio-sync";
export { audioTrackColor } from "./lib/audio-track-color";
export type { NativeAudioBinding } from "./lib/native-audio-runtime";
export {
  connectNativeAudioBinding,
  disconnectNativeAudioBinding,
  getOrCreateNativeAudioBinding,
} from "./lib/native-audio-runtime";
export type { StereoAudioMeterNodes } from "./lib/stereo-audio-meter";
export {
  amplitudeToMeterLevel,
  createStereoAudioMeterNodes,
  disconnectStereoAudioMeterNodes,
  isMonoAudioMix,
  meterZoneLevels,
  peakAmplitude,
  smoothMeterLevel,
  updatePeakHold,
} from "./lib/stereo-audio-meter";

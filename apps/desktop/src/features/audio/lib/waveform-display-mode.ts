import type { TFunction } from "i18next";

const WAVEFORM_DISPLAY_MODES = ["peak", "rms", "stereo"] as const;

type WaveformDisplayMode = (typeof WAVEFORM_DISPLAY_MODES)[number];

function isWaveformDisplayMode(value: string): value is WaveformDisplayMode {
  return (WAVEFORM_DISPLAY_MODES as readonly string[]).includes(value);
}

function waveformDisplayModeLabel(mode: WaveformDisplayMode, t: TFunction): string {
  switch (mode) {
    case "peak":
      return t("audio.waveform.displayMode.peakShort");
    case "rms":
      return t("audio.waveform.displayMode.rmsShort");
    case "stereo":
      return t("audio.waveform.displayMode.stereoShort");
  }
}

export { isWaveformDisplayMode, WAVEFORM_DISPLAY_MODES, waveformDisplayModeLabel };
export type { WaveformDisplayMode };

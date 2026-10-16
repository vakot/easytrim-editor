import type { TFunction } from "i18next";

import type { AudioStream } from "@/lib/tauri/media.types";

function formatChannels(stream: AudioStream, t: TFunction): string {
  if (stream.channelLayout) return stream.channelLayout;
  return stream.channels === undefined
    ? t("audio.tracks.unknownLayout")
    : t("audio.tracks.channels", { count: stream.channels });
}

/** Formats a linear Track Volume multiplier as a percentage. */
function formatTrackVolume(volume: number, language: string): string {
  return new Intl.NumberFormat(language, { maximumFractionDigits: 1, style: "percent" }).format(
    volume,
  );
}

function audioOutputSummary(enabledCount: number, mergeAudio: boolean, t: TFunction): string {
  if (enabledCount === 0) return t("audio.output.videoOnly");
  if (mergeAudio && enabledCount > 1) {
    return t("audio.output.merged", { count: enabledCount });
  }
  if (mergeAudio) return t("audio.output.oneTrack");
  return t("audio.output.separate", { count: enabledCount });
}

export { audioOutputSummary, formatChannels, formatTrackVolume };

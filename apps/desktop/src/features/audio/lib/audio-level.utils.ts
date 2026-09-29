import type { TFunction } from "i18next";

import type { AudioStream } from "@/lib/tauri/media.types";

function formatChannels(stream: AudioStream, t: TFunction): string {
  if (stream.channelLayout) return stream.channelLayout;
  return stream.channels === undefined
    ? t("audio.options.unknownLayout")
    : t("audio.options.channels", { count: stream.channels });
}

function audioOutputSummary(enabledCount: number, mergeAudio: boolean, t: TFunction): string {
  if (enabledCount === 0) return t("audio.messages.output.videoOnly");
  if (mergeAudio && enabledCount > 1) {
    return t("audio.messages.output.merged", { count: enabledCount });
  }
  if (mergeAudio) return t("audio.messages.output.oneTrack");
  return t("audio.messages.output.separate", { count: enabledCount });
}

export { audioOutputSummary, formatChannels };

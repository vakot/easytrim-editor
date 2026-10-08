import { useTranslation } from "react-i18next";

import type { AudioTrackController } from "../../../hooks/useAudioTrackController";
import { formatChannels } from "../../../lib/audio-level.utils";

function AudioTrackDetails({ controller }: { controller: AudioTrackController }) {
  const { t } = useTranslation();
  const { stream, track, trackNumber } = controller;
  if (!stream || !track) return null;

  const title =
    (track.metadata.title || stream.title) ??
    track.metadata.language ??
    stream.language ??
    t("audio.tracks.defaultName", { number: trackNumber });

  return (
    <div className="min-w-0 flex-1">
      <p
        className="truncate text-sm font-semibold transition-colors data-[enabled=false]:text-muted-foreground"
        data-enabled={track.enabled}
      >
        {title}
      </p>
      <p className="truncate text-xs text-muted-foreground">
        #{trackNumber} · {stream.codecName.toUpperCase()} · {formatChannels(stream, t)}
        {track.metadata.isDefault ? ` · ${t("audio.tracks.metadata.fields.default.label")}` : ""}
      </p>
    </div>
  );
}

export { AudioTrackDetails };

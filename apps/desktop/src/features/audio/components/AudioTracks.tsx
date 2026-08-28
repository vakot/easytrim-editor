import { Info } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { timelinePercent } from "@/domain/trim";

import { useWaveformPreparation } from "../hooks/useWaveformPreparation";
import { audioOutputSummary } from "../lib/audio-level";

import type { AudioTracksProps } from "./audio-contracts";
import { AudioLevelControl } from "./AudioLevelControl";
import { AudioTrackRow } from "./AudioTrackRow";
import { VolumeButton } from "./VolumeButton";

export function AudioTracks({
  streams,
  tracks,
  masterEnabled,
  masterVolumePercent,
  range,
  playheadMicros,
  playheadRef,
  mergeAudio,
  waveformPreparationEnabled,
  onToggleTrack,
  onTrackVolumeChange,
  onToggleMaster,
  onMasterVolumeChange,
  onToggleMerge,
  onPrepareWaveforms,
  onWaveformImageError,
}: AudioTracksProps) {
  const { t } = useTranslation();
  const playheadPercent = timelinePercent(playheadMicros, range.sourceDurationMicros);
  const enabledCount = tracks.filter((track) => track.enabled).length;
  const outputSummary = audioOutputSummary(enabledCount, mergeAudio, t);

  useWaveformPreparation(tracks, waveformPreparationEnabled, onPrepareWaveforms);

  if (streams.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("audio.noTracks")}</p>;
  }

  return (
    <section className="grid min-w-0 gap-2" aria-labelledby="timeline-audio-title">
      <h3
        id="timeline-audio-title"
        className="font-heading text-xs font-bold tracking-[0.16em] text-primary uppercase"
      >
        {t("audio.title")}
      </h3>
      <div className="grid min-w-0 grid-cols-[var(--editor-track-grid-columns)] items-center gap-3">
        <div className="flex min-w-0 items-center gap-2 p-1 pr-2">
          <VolumeButton
            enabled={masterEnabled}
            label={t("audio.allTracks")}
            onClick={onToggleMaster}
          />
          <AudioLevelControl
            label={t("audio.allTracksVolume")}
            volumePercent={masterEnabled ? masterVolumePercent : 0}
            onChange={onMasterVolumeChange}
            className="flex-1"
          />
        </div>
        <div className="flex min-w-0 items-center justify-between gap-4">
          <p className="truncate text-xs leading-5 text-muted-foreground">{outputSummary}</p>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex shrink-0 items-center gap-2">
                <Checkbox id="merge-audio" checked={mergeAudio} onCheckedChange={onToggleMerge} />
                <Label htmlFor="merge-audio" className="text-xs text-muted-foreground">
                  {t("audio.mergeSelected")}
                </Label>
                <Info aria-hidden="true" className="size-3.5 text-muted-foreground" />
              </div>
            </TooltipTrigger>
            <TooltipContent>{t("audio.mergeSelectedHint")}</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div className="relative grid min-w-0 gap-2">
        {streams.map((stream, index) => {
          const track = tracks.find((candidate) => candidate.streamIndex === stream.streamIndex);
          if (!track) return null;
          const title =
            stream.title ?? stream.language ?? t("audio.defaultTrack", { number: index + 1 });
          return (
            <AudioTrackRow
              key={stream.streamIndex}
              stream={stream}
              track={track}
              title={title}
              onToggle={onToggleTrack}
              onVolumeChange={onTrackVolumeChange}
              onPrepareWaveform={onPrepareWaveforms}
              onWaveformImageError={onWaveformImageError}
            />
          );
        })}
        <div
          className="pointer-events-none absolute inset-x-0 inset-y-[-0.25rem] grid min-w-0 grid-cols-[var(--editor-track-grid-columns)] gap-3"
          data-slot="audio-playhead-grid"
          aria-hidden="true"
        >
          <div className="relative col-start-2 mx-px" data-slot="audio-playhead-track">
            <div
              ref={playheadRef}
              className="audio-playhead absolute inset-y-0 border-l border-dashed border-foreground/70"
              style={{ left: `${playheadPercent}%` }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

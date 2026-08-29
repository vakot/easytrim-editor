import { Info } from "lucide-react";
import type { RefObject } from "react";
import { useTranslation } from "react-i18next";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import type { AudioTrackState } from "@/app/store/slices/audio-slice";
import { timelinePercent, type TrimRange } from "@/domain/trim";
import type { AudioStream } from "@/lib/tauri/media.types";

import { useWaveformPreparation } from "../hooks/useWaveformPreparation";
import { audioOutputSummary } from "../lib/audio-level.utils";

import { AudioLevelControl } from "./AudioLevelControl";
import { AudioTrackRow } from "./AudioTrackRow";
import { VolumeButton } from "./VolumeButton";

interface AudioTracksProps {
  masterEnabled: boolean;
  masterVolumePercent: number;
  mergeAudio: boolean;
  onMasterVolumeChange: (volumePercent: number) => void;
  onPrepareWaveforms: (streamIndexes: number[], width: number) => void;
  onToggleMaster: () => void;
  onToggleMerge: () => void;
  onToggleTrack: (streamIndex: number) => void;
  onTrackVolumeChange: (streamIndex: number, volumePercent: number) => void;
  onWaveformImageError: (streamIndex: number) => void;
  playheadMicros: number;
  playheadRef: RefObject<HTMLDivElement | null>;
  range: TrimRange;
  streams: AudioStream[];
  tracks: AudioTrackState[];
  waveformPreparationEnabled: boolean;
}

export function AudioTracks({
  masterEnabled,
  masterVolumePercent,
  mergeAudio,
  onMasterVolumeChange,
  onPrepareWaveforms,
  onToggleMaster,
  onToggleMerge,
  onToggleTrack,
  onTrackVolumeChange,
  onWaveformImageError,
  playheadMicros,
  playheadRef,
  range,
  streams,
  tracks,
  waveformPreparationEnabled,
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
    <section aria-labelledby="timeline-audio-title" className="grid min-w-0 gap-2">
      <h3
        className="font-heading text-xs font-bold tracking-[0.16em] text-primary uppercase"
        id="timeline-audio-title"
      >
        {t("audio.title")}
      </h3>
      <div className="grid min-w-0 grid-cols-(--editor-track-grid-columns) items-center gap-3">
        <div className="flex min-w-0 items-center gap-2 p-1 pr-2">
          <VolumeButton
            enabled={masterEnabled}
            label={t("audio.allTracks")}
            onClick={onToggleMaster}
          />
          <AudioLevelControl
            className="flex-1"
            label={t("audio.allTracksVolume")}
            onChange={onMasterVolumeChange}
            volumePercent={masterEnabled ? masterVolumePercent : 0}
          />
        </div>
        <div className="flex min-w-0 items-center justify-between gap-4">
          <p className="truncate text-xs leading-5 text-muted-foreground">{outputSummary}</p>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex shrink-0 items-center gap-2">
                <Checkbox checked={mergeAudio} id="merge-audio" onCheckedChange={onToggleMerge} />
                <Label className="text-xs text-muted-foreground" htmlFor="merge-audio">
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
              onPrepareWaveform={onPrepareWaveforms}
              onToggle={onToggleTrack}
              onVolumeChange={onTrackVolumeChange}
              onWaveformImageError={onWaveformImageError}
              stream={stream}
              title={title}
              track={track}
            />
          );
        })}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 -inset-y-1 grid min-w-0 grid-cols-(--editor-track-grid-columns) gap-3"
          data-slot="audio-playhead-grid"
        >
          <div className="relative col-start-2 mx-px" data-slot="audio-playhead-track">
            <div
              className="audio-playhead absolute inset-y-0 border-l border-dashed border-foreground/70"
              ref={playheadRef}
              style={{ left: `${playheadPercent}%` }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

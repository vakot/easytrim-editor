import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { timelinePercent } from "@/domain/trim";

import { AudioLevelControl } from "./components/AudioLevelControl";
import { AudioTrackRow } from "./components/AudioTrackRow";
import { VolumeButton } from "./components/VolumeButton";
import { useWaveformPreparation } from "./hooks/use-waveform-preparation";
import type { AudioTracksProps } from "./types";
import { audioOutputSummary } from "./utils/audio-level";

export function AudioTracks({
  streams,
  tracks,
  masterEnabled,
  masterVolumePercent,
  range,
  playheadMicros,
  playheadRef,
  mergeAudio,
  onToggleTrack,
  onTrackVolumeChange,
  onToggleMaster,
  onMasterVolumeChange,
  onToggleMerge,
  onPrepareWaveforms,
  onWaveformImageError,
}: AudioTracksProps) {
  const startPercent = timelinePercent(range.startMicros, range.sourceDurationMicros);
  const endPercent = timelinePercent(range.endMicros, range.sourceDurationMicros);
  const playheadPercent = timelinePercent(playheadMicros, range.sourceDurationMicros);
  const enabledCount = tracks.filter((track) => track.enabled).length;
  const outputSummary = audioOutputSummary(enabledCount, mergeAudio);

  useWaveformPreparation(tracks, onPrepareWaveforms);

  if (streams.length === 0) {
    return <p className="text-sm text-muted-foreground">This source has no audio tracks.</p>;
  }

  return (
    <section
      className="grid min-w-0 gap-2 border-t border-border pt-4"
      aria-labelledby="timeline-audio-title"
    >
      <h3
        id="timeline-audio-title"
        className="font-heading text-xs font-bold tracking-[0.16em] text-primary uppercase"
      >
        Audio tracks
      </h3>
      <div className="grid min-w-0 grid-cols-[minmax(13rem,18rem)_minmax(0,1fr)] items-center gap-3">
        <div className="flex min-w-0 items-center gap-2 px-1 py-1">
          <VolumeButton enabled={masterEnabled} label="All audio tracks" onClick={onToggleMaster} />
          <AudioLevelControl
            label="All audio tracks volume"
            volumePercent={masterEnabled ? masterVolumePercent : 0}
            onChange={onMasterVolumeChange}
            className="flex-1"
          />
        </div>
        <div className="flex min-w-0 items-center justify-between gap-4">
          <p className="truncate text-xs leading-5 text-muted-foreground" title={outputSummary}>
            {outputSummary}
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <Checkbox id="merge-audio" checked={mergeAudio} onCheckedChange={onToggleMerge} />
            <Label htmlFor="merge-audio" className="text-xs text-muted-foreground">
              Merge selected tracks
            </Label>
          </div>
        </div>
      </div>

      <div className="relative grid min-w-0 gap-2">
        {streams.map((stream, index) => {
          const track = tracks.find((candidate) => candidate.streamIndex === stream.streamIndex);
          if (!track) return null;
          const title = stream.title ?? stream.language ?? `Audio ${index + 1}`;
          return (
            <AudioTrackRow
              key={stream.streamIndex}
              stream={stream}
              track={track}
              title={title}
              startPercent={startPercent}
              endPercent={endPercent}
              onToggle={() => onToggleTrack(stream.streamIndex)}
              onVolumeChange={(volumePercent) =>
                onTrackVolumeChange(stream.streamIndex, volumePercent)
              }
              onPrepareWaveform={(width) => onPrepareWaveforms([stream.streamIndex], width)}
              onWaveformImageError={() => onWaveformImageError(stream.streamIndex)}
            />
          );
        })}
        <div
          className="pointer-events-none absolute inset-y-[-0.25rem] right-0 left-[calc(min(18rem,100%)+0.75rem)]"
          aria-hidden="true"
        >
          <div
            ref={playheadRef}
            className="audio-playhead absolute inset-y-0 border-l border-dashed border-foreground/70"
            style={{ left: `${playheadPercent}%` }}
          />
        </div>
      </div>
    </section>
  );
}

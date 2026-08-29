import { t } from "i18next";
import { Info, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ResizablePanelControl } from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { usePlayback } from "@/app/hooks/usePlayback";
import { useTimeline } from "@/app/hooks/useTimeline";
import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  audioMergeToggled,
  audioTrackToggled,
  audioTrackVolumeChanged,
  masterAudioToggled,
  masterVolumeChanged,
  selectAudioTracks,
  selectMasterAudio,
  selectMergeAudio,
  waveformDisplayFailed,
} from "@/app/store/slices/audio-slice";
import { selectSourceMedia, selectSourceSelection } from "@/app/store/slices/source-slice";
import { selectTrim } from "@/app/store/slices/trim-slice";
import { prepareSourceWaveforms } from "@/app/store/thunks/source-media-thunks";

import { AudioLevelControl } from "./components/AudioLevelControl";
import { AudioTracks } from "./components/AudioTracks";
import { VolumeButton } from "./components/VolumeButton";
import { audioOutputSummary } from "./lib/audio-level.utils";

const EMPTY_TIMELINE_RANGE = {
  startMicros: 0,
  endMicros: 1_000_000,
  sourceDurationMicros: 1_000_000,
} as const;

export function AudioPanel() {
  const sourceSelection = useAppSelector(selectSourceSelection);
  const media = useAppSelector(selectSourceMedia);
  const trim = useAppSelector(selectTrim);
  const audioTracks = useAppSelector(selectAudioTracks);
  const mergeAudio = useAppSelector(selectMergeAudio);
  const masterAudio = useAppSelector(selectMasterAudio);
  const playback = usePlayback();
  const timeline = useTimeline();
  const dispatch = useAppDispatch();
  const sourcePath = sourceSelection?.sourcePath ?? null;
  const enabledCount = audioTracks.filter((track) => track.enabled).length;
  const outputSummary = audioOutputSummary(enabledCount, mergeAudio, t);

  return (
    <section aria-labelledby="timeline-audio-title" className="grid h-full min-w-0">
      <div className="px-3">
        <div className="flex justify-between">
          <h3
            className="font-heading text-xs font-bold tracking-[0.16em] text-primary uppercase"
            id="timeline-audio-title"
          >
            {t("audio.labels.title")}
          </h3>
          <ResizablePanelControl panelId="editor-stage-audio">
            <Button className="text-secondary-foreground" size="icon-sm" variant="ghost">
              <X aria-hidden="true" />
            </Button>
          </ResizablePanelControl>
        </div>
        <div className="grid min-w-0 grid-cols-(--editor-track-grid-columns) items-center gap-3">
          <div className="flex min-w-0 items-center gap-2 p-1 pr-2">
            <VolumeButton
              enabled={masterAudio.enabled}
              label={t("audio.labels.allTracks")}
              onClick={() => dispatch(masterAudioToggled())}
            />
            <AudioLevelControl
              className="flex-1"
              label={t("audio.accessibility.allTracksVolume")}
              onChange={(volumePercent) => dispatch(masterVolumeChanged({ volumePercent }))}
              volumePercent={masterAudio.enabled ? masterAudio.volumePercent : 0}
            />
          </div>
          <div className="flex min-w-0 items-center justify-between gap-4">
            <p className="truncate text-xs leading-5 text-muted-foreground">{outputSummary}</p>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex shrink-0 items-center gap-2">
                  <Checkbox
                    checked={mergeAudio}
                    id="merge-audio"
                    onCheckedChange={() => dispatch(audioMergeToggled())}
                  />
                  <Label className="text-xs text-muted-foreground" htmlFor="merge-audio">
                    {t("audio.actions.merge")}
                  </Label>
                  <Info aria-hidden="true" className="size-3.5 text-muted-foreground" />
                </div>
              </TooltipTrigger>
              <TooltipContent>{t("audio.tooltips.merge")}</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>

      <div className="px-5">
        <Separator />
      </div>

      <ScrollArea className="px-3" data-testid="audio-tracks-scroll">
        <div className="mt-2">
          <AudioTracks
            onPrepareWaveforms={(streamIndexes, width) =>
              sourcePath && void dispatch(prepareSourceWaveforms(sourcePath, streamIndexes, width))
            }
            onToggleTrack={(streamIndex) => dispatch(audioTrackToggled({ streamIndex }))}
            onTrackVolumeChange={(streamIndex, volumePercent) =>
              dispatch(audioTrackVolumeChanged({ streamIndex, volumePercent }))
            }
            onWaveformImageError={(streamIndex) => dispatch(waveformDisplayFailed({ streamIndex }))}
            playheadMicros={timeline.playheadMicros}
            playheadRef={playback.audioPlayheadRef}
            range={trim ?? EMPTY_TIMELINE_RANGE}
            streams={media?.audioStreams ?? []}
            tracks={audioTracks}
            waveformPreparationEnabled={playback.isReady}
          />
        </div>
      </ScrollArea>
    </section>
  );
}

import { t } from "i18next";
import { Info } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { usePlayback } from "@/app/hooks/usePlayback";
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
import { prepareSourceWaveforms } from "@/app/store/thunks/source-media-thunks";
import { diagnostics } from "@/lib/diagnostics";

import { AudioLevelControl } from "./components/AudioLevelControl";
import { AudioTracks } from "./components/AudioTracks";
import { VolumeButton } from "./components/VolumeButton";
import { audioOutputSummary } from "./lib/audio-level.utils";

export function AudioPanel() {
  const sourceSelection = useAppSelector(selectSourceSelection);
  const media = useAppSelector(selectSourceMedia);
  const audioTracks = useAppSelector(selectAudioTracks);
  const mergeAudio = useAppSelector(selectMergeAudio);
  const masterAudio = useAppSelector(selectMasterAudio);
  const playback = usePlayback();
  const dispatch = useAppDispatch();
  const sourcePath = sourceSelection?.sourcePath ?? null;
  const enabledCount = audioTracks.filter((track) => track.enabled).length;
  const outputSummary = audioOutputSummary(enabledCount, mergeAudio, t);

  return (
    <section
      aria-labelledby="timeline-audio-title"
      className="relative flex size-full min-h-0 flex-col"
    >
      <h3
        className="mx-3 mb-2 font-heading text-xs font-bold tracking-[0.16em] text-primary uppercase"
        id="timeline-audio-title"
      >
        {t("audio.labels.title")} ({audioTracks.length})
      </h3>

      <div className="grid min-w-0 grid-cols-(--editor-audio-track-grid-columns) items-center gap-3 pr-3 pl-1">
        <div className="flex min-w-0 items-center gap-2 px-1 pr-2">
          <VolumeButton
            enabled={masterAudio.enabled}
            label={t("audio.labels.allTracks")}
            onClick={() => {
              diagnostics.action("audio.master.toggle.requested", {
                type: "button",
                id: "master-mute",
              });
              dispatch(masterAudioToggled());
            }}
          />
          <AudioLevelControl
            className="flex-1"
            label={t("audio.accessibility.allTracksVolume")}
            onChange={(volumePercent) => {
              diagnostics.action(
                "audio.master.volume.requested",
                { type: "button", id: "master-volume" },
                { volumePercent },
              );
              dispatch(masterVolumeChanged({ volumePercent }));
            }}
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
                  onCheckedChange={() => {
                    diagnostics.action("audio.merge.toggle.requested", {
                      type: "button",
                      id: "merge-audio",
                    });
                    dispatch(audioMergeToggled());
                  }}
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

      <div className="relative mt-2 h-0">
        <Separator className="absolute bg-foreground/10" />
      </div>

      <ScrollArea className="min-h-0 flex-1 pr-3 pl-1" data-testid="audio-tracks-scroll">
        <div className="my-2">
          <AudioTracks
            onPrepareWaveforms={(streamIndexes, width) =>
              sourcePath && void dispatch(prepareSourceWaveforms(sourcePath, streamIndexes, width))
            }
            onToggleTrack={(streamIndex) => {
              diagnostics.action(
                "audio.track.toggle.requested",
                { type: "button", id: "track-toggle" },
                { streamIndex },
              );
              dispatch(audioTrackToggled({ streamIndex }));
            }}
            onTrackVolumeChange={(streamIndex, volumePercent) => {
              diagnostics.action(
                "audio.track.volume.requested",
                { type: "button", id: "track-volume" },
                { streamIndex, volumePercent },
              );
              dispatch(audioTrackVolumeChanged({ streamIndex, volumePercent }));
            }}
            onWaveformImageError={(streamIndex) => dispatch(waveformDisplayFailed({ streamIndex }))}
            streams={media?.audioStreams ?? []}
            tracks={audioTracks}
            waveformPreparationEnabled={playback.isReady}
          />
        </div>
      </ScrollArea>
    </section>
  );
}

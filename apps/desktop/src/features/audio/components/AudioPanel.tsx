import { t } from "i18next";
import { Info } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  audioMergeToggled,
  selectAudioTracks,
  selectMergeAudio,
} from "@/app/store/slices/audio-slice";
import { selectSourceMedia } from "@/app/store/slices/source-slice";
import { commitActiveEditingInstanceDraft } from "@/app/store/thunks/source-media-thunks";
import { diagnostics } from "@/lib/diagnostics";

import { audioOutputSummary } from "../lib/audio-level.utils";

import { AudioTracks } from "./AudioTracks";

function AudioPanel() {
  const media = useAppSelector(selectSourceMedia);
  const audioTracks = useAppSelector(selectAudioTracks);
  const mergeAudio = useAppSelector(selectMergeAudio);
  const dispatch = useAppDispatch();
  const enabledCount = audioTracks.filter((track) => track.enabled).length;
  const outputSummary = audioOutputSummary(enabledCount, mergeAudio, t);

  return (
    <section
      aria-labelledby="timeline-audio-title"
      className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
    >
      <h3
        className="mx-3 mb-2 font-heading text-xs font-bold tracking-[0.16em] text-primary uppercase"
        id="timeline-audio-title"
      >
        {t("audio.labels.title")} ({audioTracks.length})
      </h3>

      <div className="flex min-w-0 items-center justify-between gap-4 px-3">
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
                  dispatch(commitActiveEditingInstanceDraft());
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

      <div className="relative mx-3 mt-2 h-0">
        <Separator className="absolute bg-foreground/10" />
      </div>

      <ScrollArea className="min-h-0 flex-1 pr-3" data-testid="audio-tracks-scroll">
        <div className="my-2 pl-3">
          <AudioTracks streams={media?.audioStreams ?? []} tracks={audioTracks} />
        </div>
      </ScrollArea>
    </section>
  );
}

export { AudioPanel };

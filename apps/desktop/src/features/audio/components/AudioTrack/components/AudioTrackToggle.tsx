import { Volume2, VolumeOff } from "lucide-react";
import type { ComponentPropsWithoutRef } from "react";
import { forwardRef } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { useAppDispatch } from "@/app/store/redux-hooks";
import { type AudioTrackState, audioTrackToggled } from "@/app/store/slices/audio-slice";
import { commitActiveEditingInstanceDraft } from "@/app/store/thunks/source-media-thunks";
import { cn } from "@/lib/class-names.utils";
import { diagnostics } from "@/lib/diagnostics";
import type { AudioStream } from "@/lib/tauri/media.types";

type AudioTrackToggleProps = ComponentPropsWithoutRef<typeof Button> & {
  stream: AudioStream;
  track: AudioTrackState;
};

const AudioTrackToggle = forwardRef<HTMLButtonElement, AudioTrackToggleProps>(
  function AudioTrackToggle({ className, onClick, stream, track, ...props }, ref) {
    const { t } = useTranslation();
    const dispatch = useAppDispatch();
    const title =
      stream.title ??
      stream.language ??
      t("audio.labels.defaultTrack", { number: stream.streamIndex });

    const label = track.enabled
      ? t("audio.actions.muteTrack", { title })
      : t("audio.actions.unmuteTrack", { title });

    return (
      <Tooltip preserveOnTrigger>
        <TooltipTrigger asChild>
          <Button
            aria-label={label}
            aria-pressed={track.enabled}
            className={cn("text-primary", className)}
            onClick={(event) => {
              diagnostics.action(
                "audio.track.toggle.requested",
                { type: "button", id: "track-toggle" },
                { streamIndex: stream.streamIndex },
              );
              dispatch(audioTrackToggled(stream));
              dispatch(commitActiveEditingInstanceDraft());
              onClick?.(event);
            }}
            ref={ref}
            size="icon-sm"
            type="button"
            variant="ghost"
            {...props}
          >
            {track.enabled ? <Volume2 /> : <VolumeOff />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    );
  },
);

export { AudioTrackToggle };

import { Volume2, VolumeOff } from "lucide-react";
import type { ComponentPropsWithoutRef } from "react";
import { forwardRef } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { cn } from "@/lib/class-names.utils";
import { diagnostics } from "@/lib/diagnostics";

import type { AudioTrackController } from "../../../hooks/useAudioTrackController";

type AudioTrackToggleProps = ComponentPropsWithoutRef<typeof Button> & {
  controller: AudioTrackController;
};

const AudioTrackToggle = forwardRef<HTMLButtonElement, AudioTrackToggleProps>(
  function AudioTrackToggle({ className, controller, onClick, ...props }, ref) {
    const { t } = useTranslation();
    const { isEnabled, setEnabled, stream, track, trackNumber } = controller;
    if (!stream || !track) return null;
    const title =
      stream.title ?? stream.language ?? t("audio.tracks.defaultName", { number: trackNumber });

    const label = isEnabled
      ? t("audio.tracks.muteWithTitle", { title })
      : t("audio.tracks.unmuteWithTitle", { title });

    return (
      <Tooltip preserveOnTrigger>
        <TooltipTrigger asChild>
          <Button
            aria-label={label}
            aria-pressed={isEnabled}
            className={cn("text-primary", className)}
            onClick={(event) => {
              diagnostics.action(
                "audio.track.toggle.requested",
                { type: "button", id: "track-toggle" },
                { streamIndex: stream.streamIndex },
              );
              setEnabled(!isEnabled);
              onClick?.(event);
            }}
            ref={ref}
            size="icon-sm"
            type="button"
            variant="ghost"
            {...props}
          >
            {isEnabled ? <Volume2 /> : <VolumeOff />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    );
  },
);

export { AudioTrackToggle };

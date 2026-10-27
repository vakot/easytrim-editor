import { SlidersHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@easytrim-editor/ui/button";
import { cn } from "@easytrim-editor/ui/class-names";
import { Tooltip, TooltipContent, TooltipTrigger } from "@easytrim-editor/ui/tooltip";

import { AudioTrackFiltersDialogTrigger } from "../../../dialogs/AudioTrackFiltersDialog";
import { useAudioTrackController } from "../../../hooks/useAudioTrackController";

/**
 * Opens the track's Audio Filters dialog from its waveform. It stays available whatever state the
 * waveform is in, and its color alone tells whether the chain has any filter.
 */
function AudioTrackFiltersShortcut({ streamIndex }: { streamIndex: number }) {
  const { t } = useTranslation();
  const { track, trackNumber } = useAudioTrackController(streamIndex);
  if (!track) return null;

  const hasFilters = track.processing.filters.length > 0;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <AudioTrackFiltersDialogTrigger asChild>
          <Button
            aria-label={t("audio.filters.actions.openForTrack", { number: trackNumber })}
            className={cn(
              "bg-transparent hover:bg-transparent dark:hover:bg-transparent data-open:bg-transparent",
              hasFilters
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground data-open:text-foreground",
            )}
            data-has-filters={hasFilters}
            data-slot="audio-track-filters-shortcut"
            size="icon-xs"
            type="button"
            variant="ghost"
          >
            <SlidersHorizontal aria-hidden="true" />
          </Button>
        </AudioTrackFiltersDialogTrigger>
      </TooltipTrigger>
      <TooltipContent>{t("audio.filters.actions.open")}</TooltipContent>
    </Tooltip>
  );
}

export { AudioTrackFiltersShortcut };

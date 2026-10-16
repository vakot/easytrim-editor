import { SlidersHorizontal } from "lucide-react";
import { useMemo, useReducer } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia } from "@/components/ui/empty";
import { Separator } from "@/components/ui/separator";

import { Library, LibraryContent, LibraryPage } from "@/components/library";

import { useAudioTrackController } from "../../hooks/useAudioTrackController";
import { audioTrackDisplayName } from "../../lib/audio-track-name.utils";

import { AudioFilterList } from "./components/AudioFilterList";
import { AudioFilterPage } from "./components/AudioFilterPage";
import { AudioFilterPreviewStatus } from "./components/AudioFilterPreviewStatus";
import { AudioFiltersDraftContext } from "./contexts/audio-filters-draft-context";
import { useAudioFilterPreview } from "./hooks/useAudioFilterPreview";
import { useAudioTrackFiltersDialogScope } from "./hooks/useAudioTrackFiltersDialogScope";
import {
  audioFiltersDraftReducer,
  createAudioFiltersDraft,
  isAudioFiltersDraftDirty,
  isAudioFiltersDraftValid,
} from "./lib/audio-filters-draft";

interface AudioTrackFiltersDialogContentProps {
  onClose: () => void;
  streamIndex: number;
}

/**
 * Edits a draft initialized from the committed chain. Playback auditions the latest valid draft
 * while the dialog is open. Cancel discards it; Apply commits the whole validated chain at once,
 * keeping the identity of every unchanged instance.
 */
function AudioTrackFiltersDialogContent({
  onClose,
  streamIndex,
}: AudioTrackFiltersDialogContentProps) {
  const { t } = useTranslation();
  const dialogScope = useAudioTrackFiltersDialogScope(undefined);
  const { applyFilters, stream, track, trackNumber } = useAudioTrackController(streamIndex);
  const [draft, dispatch] = useReducer(
    audioFiltersDraftReducer,
    track?.processing.filters ?? [],
    createAudioFiltersDraft,
  );

  const draftContext = useMemo(() => ({ dispatch, draft }), [draft]);
  useAudioFilterPreview(streamIndex, draft);

  if (!track || !stream) return null;

  const title = audioTrackDisplayName(
    track.metadata,
    stream,
    t("audio.tracks.defaultName", { number: trackNumber }),
  );

  const valid = isAudioFiltersDraftValid(draft);
  const dirty = isAudioFiltersDraftDirty(draft);
  const selected = draft.filters.find((filter) => filter.id === draft.selectedId);

  return (
    <AudioFiltersDraftContext.Provider value={draftContext}>
      <DialogHeader className="m-0! border-b p-4">
        <DialogTitle {...dialogScope}>{t("audio.filters.dialog.title", { title })}</DialogTitle>
        <DialogDescription {...dialogScope}>
          {t("audio.filters.dialog.description")}
        </DialogDescription>
      </DialogHeader>

      <Library
        onValueChange={(id) => dispatch({ id, type: "selected" })}
        value={draft.selectedId ?? ""}
      >
        <AudioFilterList />
        <Separator orientation="vertical" />
        <LibraryContent>
          {selected ? (
            <LibraryPage value={selected.id}>
              <AudioFilterPage filter={selected} key={selected.id} />
            </LibraryPage>
          ) : (
            <Empty className="h-full gap-2 border-0 p-4">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <SlidersHorizontal aria-hidden="true" />
                </EmptyMedia>
                <EmptyDescription>{t("audio.filters.dialog.emptyPage")}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </LibraryContent>
      </Library>

      <DialogFooter className="m-0! items-center rounded-none sm:justify-between">
        {valid ? (
          <AudioFilterPreviewStatus />
        ) : (
          <p className="min-w-0 flex-1 text-xs text-destructive" role="alert">
            {t("audio.filters.dialog.invalid")}
          </p>
        )}
        <div className="flex shrink-0 flex-col-reverse gap-2 sm:flex-row">
          <Button onClick={onClose} type="button" variant="outline">
            {t("common.actions.cancel")}
          </Button>
          <Button
            disabled={!dirty || !valid}
            onClick={() => {
              applyFilters(draft.filters);
              onClose();
            }}
            type="button"
          >
            {t("common.actions.apply")}
          </Button>
        </div>
      </DialogFooter>
    </AudioFiltersDraftContext.Provider>
  );
}

export { AudioTrackFiltersDialogContent };

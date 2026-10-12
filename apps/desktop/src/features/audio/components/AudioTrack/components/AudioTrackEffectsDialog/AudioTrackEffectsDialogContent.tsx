import { useTranslation } from "react-i18next";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { localizeAppError } from "@/i18n/app-errors";

import type { AudioTrackController } from "../../../../hooks/useAudioTrackController";
import { audioTrackDisplayName } from "../../../../lib/audio-track-name.utils";
import { AudioTrackEffectsLibrary } from "../AudioTrackEffectsLibrary";
import {
  AUDIO_TRACK_EFFECTS,
  type AudioTrackEffectId,
} from "../AudioTrackEffectsLibrary/consts/audio-track-effects";

import { useAudioTrackEffectsDraft } from "./contexts/audio-track-effects-draft-context";
import {
  getAudioTrackEffectsDraftProcessing,
  isAudioTrackEffectsDraftDirty,
  isAudioTrackEffectsDraftValid,
} from "./audio-track-effects-draft.utils";

interface AudioTrackEffectsDialogContentProps {
  controller: AudioTrackController;
  initialView?: AudioTrackEffectId;
}

function AudioTrackEffectsDialogContent({
  controller,
  initialView,
}: AudioTrackEffectsDialogContentProps) {
  const { t } = useTranslation();
  const { draft } = useAudioTrackEffectsDraft();
  const track = controller.track;
  const stream = controller.stream;
  if (!track || !stream) return null;

  const title = audioTrackDisplayName(
    track.metadata,
    stream,
    t("audio.tracks.defaultName", { number: controller.trackNumber }),
  );

  const draftProcessing = getAudioTrackEffectsDraftProcessing(draft);
  const isDirty = isAudioTrackEffectsDraftDirty(draft, AUDIO_TRACK_EFFECTS);
  const isValid = isAudioTrackEffectsDraftValid(draft, AUDIO_TRACK_EFFECTS);

  return (
    <DialogContent className="h-full max-h-[min(80dvh,32rem)] grid-rows-[auto_minmax(0,1fr)_auto_auto] gap-0 overflow-hidden p-0 sm:max-w-3xl">
      <DialogHeader className="m-0! -mx-4 border-b p-4">
        <DialogTitle>{t("audio.effects.dialog.title", { title })}</DialogTitle>
        <DialogDescription>{t("audio.effects.dialog.description")}</DialogDescription>
      </DialogHeader>

      <AudioTrackEffectsLibrary initialView={initialView} streamIndex={track.streamIndex} />

      {track.preview.status === "loading" || track.preview.status === "failed" ? (
        <div className="-mx-4 border-t px-4 py-2">
          {track.preview.status === "loading" ? (
            <p className="text-xs text-muted-foreground" role="status">
              {t("audio.tracks.preparingPreview")}
            </p>
          ) : (
            <Alert role="alert" variant="destructive">
              <AlertDescription>{localizeAppError(track.preview.error, t)}</AlertDescription>
            </Alert>
          )}
        </div>
      ) : null}

      <DialogFooter className="m-0! min-w-0 items-center sm:justify-between">
        <p className="min-w-0 flex-1 text-xs text-muted-foreground">
          {t("audio.effects.dialog.applyNotice")}
        </p>
        <div className="flex shrink-0 flex-col-reverse gap-2 sm:flex-row">
          <DialogClose asChild>
            <Button type="button" variant="outline">
              {t("common.actions.cancel")}
            </Button>
          </DialogClose>
          <DialogClose asChild>
            <Button
              disabled={!isDirty || !isValid}
              onClick={() => controller.applyProcessing(draftProcessing)}
              type="button"
            >
              {t("common.actions.apply")}
            </Button>
          </DialogClose>
        </div>
      </DialogFooter>
    </DialogContent>
  );
}

export { AudioTrackEffectsDialogContent };
export type { AudioTrackEffectsDialogContentProps };

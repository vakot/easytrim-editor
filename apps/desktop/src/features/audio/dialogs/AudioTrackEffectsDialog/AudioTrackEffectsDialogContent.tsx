import { useTranslation } from "react-i18next";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { localizeAppError } from "@/i18n/app-errors";

import { AudioTrackEffectsLibrary } from "../../components/AudioTrack/components/AudioTrackEffectsLibrary";
import {
  AUDIO_TRACK_EFFECTS,
  type AudioTrackEffectId,
} from "../../components/AudioTrack/components/AudioTrackEffectsLibrary/consts/audio-track-effects";
import type { AudioTrackController } from "../../hooks/useAudioTrackController";
import { audioTrackDisplayName } from "../../lib/audio-track-name.utils";

import { AudioTrackEffectsDraftProvider } from "./components/AudioTrackEffectsDraftProvider";
import { useAudioTrackEffectsDraft } from "./contexts/audio-track-effects-draft-context";
import {
  getAudioTrackEffectsDraftProcessing,
  isAudioTrackEffectsDraftDirty,
  isAudioTrackEffectsDraftValid,
} from "./audio-track-effects-draft.utils";

interface AudioTrackEffectsDialogContentProps {
  controller: AudioTrackController;
  initialProcessing: import("@/domain/audio-processing").AudioTrackProcessing;
  initialView?: AudioTrackEffectId;
}

function AudioTrackEffectsDialogContent({
  controller,
  initialProcessing,
  initialView,
}: AudioTrackEffectsDialogContentProps) {
  return (
    <AudioTrackEffectsDraftProvider initialProcessing={initialProcessing}>
      <AudioTrackEffectsDialogPanel controller={controller} initialView={initialView} />
    </AudioTrackEffectsDraftProvider>
  );
}

function AudioTrackEffectsDialogPanel({
  controller,
  initialView,
}: Omit<AudioTrackEffectsDialogContentProps, "initialProcessing">) {
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
    <>
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
    </>
  );
}

export { AudioTrackEffectsDialogContent };
export type { AudioTrackEffectsDialogContentProps };

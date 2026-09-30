import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { sameAudioTrackProcessing } from "@/domain/audio-processing";

import type { AudioTrackController } from "../../../../hooks/useAudioTrackController";

import { AudioTrackEffectsDraftProvider } from "./components/AudioTrackEffectsDraftProvider";
import { LoudnessControls } from "./components/LoudnessControls";
import { AudioTrackEffectsDialogContext } from "./contexts/audio-track-effects-dialog-context";
import { useAudioTrackEffectsDraft } from "./contexts/audio-track-effects-draft-context";

interface AudioTrackEffectsDialogProps {
  children: ReactNode;
  controller: AudioTrackController;
}

function AudioTrackEffectsDialog({ children, controller }: AudioTrackEffectsDialogProps) {
  const [open, setOpen] = useState(false);
  const [draftSession, setDraftSession] = useState(0);
  const track = controller.track;
  const stream = controller.stream;

  if (!track || !stream) return children;

  const openEffects = () => {
    setDraftSession((session) => session + 1);
    setOpen(true);
  };

  return (
    <AudioTrackEffectsDialogContext.Provider value={{ openEffects }}>
      {children}

      <Dialog onOpenChange={setOpen} open={open}>
        <AudioTrackEffectsDraftProvider initialProcessing={track.processing} key={draftSession}>
          <AudioTrackEffectsDialogContent controller={controller} />
        </AudioTrackEffectsDraftProvider>
      </Dialog>
    </AudioTrackEffectsDialogContext.Provider>
  );
}

function AudioTrackEffectsDialogContent({ controller }: { controller: AudioTrackController }) {
  const { t } = useTranslation();
  const { draft } = useAudioTrackEffectsDraft();
  const track = controller.track;
  const stream = controller.stream;
  if (!track || !stream) return null;

  const title =
    stream.title ??
    stream.language ??
    t("audio.labels.defaultTrack", { number: controller.trackNumber });

  const normalization = draft.processing.loudnessNormalization;
  const customNormalization = typeof normalization === "object" && normalization.mode === "custom";
  const isDirty = !sameAudioTrackProcessing(track.processing, draft.processing);
  const hasValidCustomNormalization =
    !customNormalization ||
    (isInRange(draft.targetLufsInput, -36, -5) && isInRange(draft.maxTruePeakDbInput, -9, 0));

  return (
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{t("audio.dialogs.effects.title", { title })}</DialogTitle>
        <DialogDescription>{t("audio.dialogs.effects.description")}</DialogDescription>
      </DialogHeader>

      <LoudnessControls streamIndex={track.streamIndex} />

      {track.preview.status === "loading" ? (
        <p className="text-xs text-muted-foreground" role="status">
          {t("audio.messages.preparingProcessedPreview")}
        </p>
      ) : null}
      {track.preview.status === "failed" ? (
        <Alert role="alert" variant="destructive">
          <AlertDescription>{track.preview.error.message}</AlertDescription>
        </Alert>
      ) : null}

      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">
            {t("common.actions.cancel")}
          </Button>
        </DialogClose>
        <DialogClose asChild>
          <Button
            disabled={!isDirty || !hasValidCustomNormalization}
            onClick={() => controller.applyProcessing(draft.processing)}
            type="button"
          >
            {t("common.actions.apply")}
          </Button>
        </DialogClose>
      </DialogFooter>
    </DialogContent>
  );
}

function isInRange(value: string, min: number, max: number): boolean {
  if (value.trim() === "") return false;
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max;
}

export { AudioTrackEffectsDialog };

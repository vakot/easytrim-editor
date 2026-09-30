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

import type { AudioTrackController } from "../../../../hooks/useAudioTrackController";
import { AudioTrackEffectsLibrary } from "../AudioTrackEffectsLibrary";
import { AUDIO_TRACK_EFFECTS } from "../AudioTrackEffectsLibrary/audio-track-effects.registry";

import { AudioTrackEffectsDraftProvider } from "./components/AudioTrackEffectsDraftProvider";
import { AudioTrackEffectsDialogContext } from "./contexts/audio-track-effects-dialog-context";
import { useAudioTrackEffectsDraft } from "./contexts/audio-track-effects-draft-context";
import {
  getAudioTrackEffectsDraftProcessing,
  isAudioTrackEffectsDraftDirty,
  isAudioTrackEffectsDraftValid,
} from "./audio-track-effects-draft.utils";

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

  const draftProcessing = getAudioTrackEffectsDraftProcessing(draft);
  const isDirty = isAudioTrackEffectsDraftDirty(draft, AUDIO_TRACK_EFFECTS);
  const isValid = isAudioTrackEffectsDraftValid(draft, AUDIO_TRACK_EFFECTS);

  return (
    <DialogContent className="max-h-[calc(100dvh-2rem)] gap-0 overflow-hidden sm:max-w-3xl">
      <DialogHeader className="-mx-4 border-b px-4 pb-4">
        <DialogTitle>{t("audio.dialogs.effects.title", { title })}</DialogTitle>
        <DialogDescription>{t("audio.dialogs.effects.description")}</DialogDescription>
      </DialogHeader>

      <AudioTrackEffectsLibrary streamIndex={track.streamIndex} />

      {track.preview.status === "loading" || track.preview.status === "failed" ? (
        <div className="-mx-4 border-t px-4 py-2">
          {track.preview.status === "loading" ? (
            <p className="text-xs text-muted-foreground" role="status">
              {t("audio.messages.preparingProcessedPreview")}
            </p>
          ) : (
            <Alert role="alert" variant="destructive">
              <AlertDescription>{track.preview.error.message}</AlertDescription>
            </Alert>
          )}
        </div>
      ) : null}

      <DialogFooter className="-mx-4 border-t px-4 pt-4">
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
      </DialogFooter>
    </DialogContent>
  );
}

export { AudioTrackEffectsDialog };

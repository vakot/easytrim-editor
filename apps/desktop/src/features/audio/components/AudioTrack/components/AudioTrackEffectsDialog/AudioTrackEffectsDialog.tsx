import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

import {
  LibraryDialog,
  LibraryDialogClose,
  LibraryDialogContent,
  LibraryDialogDescription,
  LibraryDialogFooter,
  LibraryDialogHeader,
  LibraryDialogTitle,
} from "@/components/library";
import { localizeAppError } from "@/i18n/app-errors";

import type { AudioTrackController } from "../../../../hooks/useAudioTrackController";
import { AudioTrackEffectsLibrary } from "../AudioTrackEffectsLibrary";
import { AUDIO_TRACK_EFFECTS } from "../AudioTrackEffectsLibrary/consts/audio-track-effects";

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

      <LibraryDialog onOpenChange={setOpen} open={open}>
        <AudioTrackEffectsDraftProvider initialProcessing={track.processing} key={draftSession}>
          <AudioTrackEffectsDialogContent controller={controller} />
        </AudioTrackEffectsDraftProvider>
      </LibraryDialog>
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
    t("audio.tracks.defaultName", { number: controller.trackNumber });

  const draftProcessing = getAudioTrackEffectsDraftProcessing(draft);
  const isDirty = isAudioTrackEffectsDraftDirty(draft, AUDIO_TRACK_EFFECTS);
  const isValid = isAudioTrackEffectsDraftValid(draft, AUDIO_TRACK_EFFECTS);

  return (
    <LibraryDialogContent>
      <LibraryDialogHeader className="-mx-4 border-b px-4 pb-4">
        <LibraryDialogTitle>{t("audio.effects.dialog.title", { title })}</LibraryDialogTitle>
        <LibraryDialogDescription>{t("audio.effects.dialog.description")}</LibraryDialogDescription>
      </LibraryDialogHeader>

      <AudioTrackEffectsLibrary streamIndex={track.streamIndex} />

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

      <LibraryDialogFooter className="min-w-0 items-center sm:justify-between">
        <p className="min-w-0 flex-1 text-xs text-muted-foreground">
          {t("audio.effects.dialog.applyNotice")}
        </p>
        <div className="flex shrink-0 flex-col-reverse gap-2 sm:flex-row">
          <LibraryDialogClose asChild>
            <Button type="button" variant="outline">
              {t("common.actions.cancel")}
            </Button>
          </LibraryDialogClose>
          <LibraryDialogClose asChild>
            <Button
              disabled={!isDirty || !isValid}
              onClick={() => controller.applyProcessing(draftProcessing)}
              type="button"
            >
              {t("common.actions.apply")}
            </Button>
          </LibraryDialogClose>
        </div>
      </LibraryDialogFooter>
    </LibraryDialogContent>
  );
}

export { AudioTrackEffectsDialog };

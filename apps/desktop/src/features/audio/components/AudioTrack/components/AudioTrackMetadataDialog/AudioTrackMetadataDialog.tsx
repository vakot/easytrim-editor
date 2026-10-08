import { ChevronsUpDown, RotateCcw } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  LanguageSelector,
  LanguageSelectorContent,
  LanguageSelectorEmpty,
  LanguageSelectorInput,
  LanguageSelectorList,
  LanguageSelectorOptions,
  LanguageSelectorTrigger,
  LanguageSelectorValue,
} from "@/components/language-selector";
import {
  AUDIO_METADATA_LANGUAGES,
  type Language,
  languageCodeFromMetadata,
} from "@/domain/languages";

import type { AudioTrackController } from "../../../../hooks/useAudioTrackController";

import {
  AudioTrackMetadataDialogContext,
  useAudioTrackMetadataDialog,
} from "./contexts/audio-track-metadata-dialog-context";

function AudioTrackMetadataDialog({
  children,
  controller,
}: {
  children: ReactNode;
  controller: AudioTrackController;
}) {
  const [open, setOpen] = useState(false);
  const [dialogSession, setDialogSession] = useState(0);
  const track = controller.track;
  const stream = controller.stream;

  if (!track || !stream) return children;

  const openMetadataDialog = () => {
    setDialogSession((session) => session + 1);
    setOpen(true);
  };

  const closeMetadataDialog = () => setOpen(false);

  return (
    <AudioTrackMetadataDialogContext.Provider value={{ closeMetadataDialog, openMetadataDialog }}>
      {children}

      <Dialog onOpenChange={setOpen} open={open}>
        <AudioTrackMetadataDialogContent controller={controller} key={dialogSession} />
      </Dialog>
    </AudioTrackMetadataDialogContext.Provider>
  );
}

function AudioTrackMetadataDialogContent({ controller }: { controller: AudioTrackController }) {
  const { t } = useTranslation();
  const { closeMetadataDialog } = useAudioTrackMetadataDialog();
  const { stream, track } = controller;
  const [metadataTitle, setMetadataTitle] = useState(track?.metadata.title ?? "");
  const [metadataTitleChanged, setMetadataTitleChanged] = useState(false);
  const [metadataLanguage, setMetadataLanguage] = useState<Language["code"] | null>(
    languageCodeFromMetadata(track?.metadata.language ?? stream?.language) ?? null,
  );

  const [metadataLanguageChanged, setMetadataLanguageChanged] = useState(false);

  if (!stream || !track) return null;

  return (
    <DialogContent>
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          controller.updateMetadata(
            metadataTitle,
            metadataTitleChanged,
            metadataLanguage ?? undefined,
            metadataLanguageChanged,
          );
          closeMetadataDialog();
        }}
      >
        <DialogHeader>
          <DialogTitle>{t("audio.tracks.metadata.title")}</DialogTitle>
          <DialogDescription>{t("audio.tracks.metadata.description")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor={`audio-track-title-${track.streamIndex}`}>
            {t("audio.tracks.metadata.fields.title.label")}
          </Label>
          <Input
            autoComplete="off"
            id={`audio-track-title-${track.streamIndex}`}
            maxLength={256}
            onChange={(event) => {
              setMetadataTitle(event.currentTarget.value);
              setMetadataTitleChanged(true);
            }}
            placeholder={stream.title ?? ""}
            value={metadataTitle}
          />
        </div>
        <div className="grid gap-2">
          <Label>{t("audio.tracks.metadata.fields.language.label")}</Label>
          <LanguageSelector
            label={t("common.search.languages")}
            languages={AUDIO_METADATA_LANGUAGES}
            onValueChange={(language) => {
              setMetadataLanguage(language);
              setMetadataLanguageChanged(true);
            }}
            value={metadataLanguage}
          >
            <div className="flex items-center gap-1">
              <LanguageSelectorTrigger asChild>
                <Button
                  aria-label={t("audio.tracks.metadata.fields.language.label")}
                  className="flex-1 justify-start"
                  type="button"
                  variant="outline"
                >
                  <LanguageSelectorValue
                    placeholder={t("audio.tracks.metadata.fields.language.actions.select")}
                  />

                  <ChevronsUpDown aria-hidden="true" className="ml-auto text-muted-foreground" />
                </Button>
              </LanguageSelectorTrigger>

              <Button
                aria-label={t("audio.tracks.metadata.fields.language.actions.reset")}
                onClick={() => {
                  setMetadataLanguage(languageCodeFromMetadata(stream.language) ?? null);
                  setMetadataLanguageChanged(true);
                }}
                size="icon"
                type="button"
                variant="outline"
              >
                <RotateCcw aria-hidden="true" />
              </Button>
            </div>

            <LanguageSelectorContent>
              <LanguageSelectorInput
                aria-label={t("common.search.languages")}
                placeholder={t("common.search.languagesPlaceholder")}
              />
              <LanguageSelectorList>
                <LanguageSelectorEmpty>
                  {t("audio.tracks.metadata.fields.language.noResults")}
                </LanguageSelectorEmpty>
                <LanguageSelectorOptions />
              </LanguageSelectorList>
            </LanguageSelectorContent>
          </LanguageSelector>
        </div>
        <DialogFooter>
          <Button type="submit">{t("common.actions.save")}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

export { AudioTrackMetadataDialog };

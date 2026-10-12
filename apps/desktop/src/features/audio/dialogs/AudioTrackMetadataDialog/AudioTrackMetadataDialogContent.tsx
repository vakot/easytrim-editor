import { ChevronsUpDown, RotateCcw } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  DialogClose,
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

import type { AudioTrackController } from "../../hooks/useAudioTrackController";
import { audioTrackDisplayName } from "../../lib/audio-track-name.utils";

import { useAudioTrackMetadataDialogScope } from "./hooks/useAudioTrackMetadataDialogScope";

interface AudioTrackMetadataDialogContentProps {
  controller: AudioTrackController;
}

function AudioTrackMetadataDialogContent({ controller }: AudioTrackMetadataDialogContentProps) {
  const { t } = useTranslation();
  const dialogScope = useAudioTrackMetadataDialogScope(undefined);
  const { stream, track, trackNumber } = controller;
  const [metadataTitle, setMetadataTitle] = useState(track?.metadata.title ?? "");
  const [metadataTitleChanged, setMetadataTitleChanged] = useState(false);
  const [metadataLanguage, setMetadataLanguage] = useState<Language["code"] | null>(
    languageCodeFromMetadata(track?.metadata.language ?? stream?.language) ?? null,
  );

  const [metadataLanguageChanged, setMetadataLanguageChanged] = useState(false);

  if (!stream || !track) return null;

  const titlePlaceholder = audioTrackDisplayName(
    track.metadata,
    stream,
    t("audio.tracks.defaultName", { number: trackNumber }),
  );

  return (
    <>
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
        }}
      >
        <DialogHeader>
          <DialogTitle {...dialogScope}>{t("audio.tracks.metadata.title")}</DialogTitle>
          <DialogDescription {...dialogScope}>
            {t("audio.tracks.metadata.description")}
          </DialogDescription>
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
            placeholder={titlePlaceholder}
            value={metadataTitle}
          />
        </div>
        <div className="grid gap-2">
          <Label>{t("audio.tracks.metadata.fields.language.label")}</Label>
          <LanguageSelector
            label={t("common.search.languages")}
            languages={AUDIO_METADATA_LANGUAGES}
            modal
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
        <DialogFooter showCloseButton {...dialogScope}>
          <DialogClose {...dialogScope} asChild>
            <Button type="submit">{t("common.actions.save")}</Button>
          </DialogClose>
        </DialogFooter>
      </form>
    </>
  );
}

export { AudioTrackMetadataDialogContent };
export type { AudioTrackMetadataDialogContentProps };

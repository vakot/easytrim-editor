import { useTranslation } from "react-i18next";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { AudioTrackSignalEffect, NoiseReductionPreset } from "@/domain/audio-processing";

import { useAudioTrackEffectsDraft } from "../../AudioTrackEffectsDialog/contexts/audio-track-effects-draft-context";
import {
  AudioTrackEffectsLibraryPage,
  AudioTrackEffectsLibraryPageBasic,
  AudioTrackEffectsLibraryPageContent,
  AudioTrackEffectsLibraryPageDescription,
  AudioTrackEffectsLibraryPageHeader,
  AudioTrackEffectsLibraryPageHeaderContent,
  AudioTrackEffectsLibraryPageTitle,
  AudioTrackEffectsLibraryPageToggle,
} from "../components/AudioTrackEffectsLibraryPage";

function NoiseReductionPage({ streamIndex }: { streamIndex: number }) {
  const { t } = useTranslation();
  const { dispatch, draft } = useAudioTrackEffectsDraft();
  const preset = draft.processing.effects?.find(
    (effect) => effect.type === "noiseReduction",
  )?.preset;

  const initialPreset = draft.initialProcessing.effects?.find(
    (effect) => effect.type === "noiseReduction",
  )?.preset;

  const updatePreset = (nextPreset: NoiseReductionPreset | undefined) => {
    const effects: AudioTrackSignalEffect[] = (draft.processing.effects ?? []).filter(
      (effect) => effect.type !== "noiseReduction",
    );

    if (nextPreset) {
      const effect: AudioTrackSignalEffect = {
        preset: nextPreset,
        stage: "cleanup",
        type: "noiseReduction",
      };

      effects.push(effect);
    }
    const processing = { ...draft.processing };
    if (effects.length === 0) delete processing.effects;
    else processing.effects = effects;

    dispatch({ type: "processingChanged", value: processing });
    dispatch({
      dirty: nextPreset !== initialPreset,
      effectId: "noiseReduction",
      type: "effectStatusChanged",
      valid: true,
    });
  };

  return (
    <AudioTrackEffectsLibraryPage>
      <AudioTrackEffectsLibraryPageHeader>
        <AudioTrackEffectsLibraryPageHeaderContent>
          <AudioTrackEffectsLibraryPageTitle>
            {t("audio.labels.noiseReduction")}
          </AudioTrackEffectsLibraryPageTitle>
          <AudioTrackEffectsLibraryPageDescription>
            {t("audio.messages.noiseReductionDescription")}
          </AudioTrackEffectsLibraryPageDescription>
        </AudioTrackEffectsLibraryPageHeaderContent>
        <AudioTrackEffectsLibraryPageToggle
          aria-label={t("audio.labels.noiseReduction")}
          checked={preset !== undefined}
          onCheckedChange={(enabled) => updatePreset(enabled ? (preset ?? "medium") : undefined)}
        />
      </AudioTrackEffectsLibraryPageHeader>

      <AudioTrackEffectsLibraryPageContent disabled={preset === undefined}>
        <AudioTrackEffectsLibraryPageBasic>
          <Label htmlFor={`track-noise-reduction-${streamIndex}`}>
            {t("audio.labels.noiseReductionStrength")}
          </Label>
          <Select
            onValueChange={(value) => {
              if (value === "off") updatePreset(undefined);
              else if (isNoiseReductionPreset(value)) updatePreset(value);
            }}
            value={preset ?? "off"}
          >
            <SelectTrigger className="w-full" id={`track-noise-reduction-${streamIndex}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="off">{t("audio.options.noiseReductionOff")}</SelectItem>
              <SelectItem value="light">{t("audio.options.noiseReductionLight")}</SelectItem>
              <SelectItem value="medium">{t("audio.options.noiseReductionMedium")}</SelectItem>
              <SelectItem value="strong">{t("audio.options.noiseReductionStrong")}</SelectItem>
            </SelectContent>
          </Select>
        </AudioTrackEffectsLibraryPageBasic>
      </AudioTrackEffectsLibraryPageContent>
    </AudioTrackEffectsLibraryPage>
  );
}

function isNoiseReductionPreset(value: string): value is NoiseReductionPreset {
  return value === "light" || value === "medium" || value === "strong";
}

export { NoiseReductionPage };

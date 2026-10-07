import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

import {
  getAudioTrackSignalEffect,
  type NoiseReductionPreset,
  removeAudioTrackSignalEffect,
  setAudioTrackSignalEffect,
} from "@/domain/audio-processing";

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
  const preset = getAudioTrackSignalEffect(draft.processing, "noiseReduction")?.preset;
  const presets: readonly NoiseReductionPreset[] = ["light", "medium", "strong"];
  const [selectedPreset, setSelectedPreset] = useState<NoiseReductionPreset>(
    () => preset ?? "medium",
  );

  const presetLabels = [
    t("audio.noiseReduction.strength.light"),
    t("audio.noiseReduction.strength.medium"),
    t("audio.noiseReduction.strength.strong"),
  ];

  const selectedPresetIndex = presets.indexOf(selectedPreset);

  const initialPreset = getAudioTrackSignalEffect(
    draft.initialProcessing,
    "noiseReduction",
  )?.preset;

  const updatePreset = (nextPreset: NoiseReductionPreset | undefined) => {
    if (nextPreset !== undefined) setSelectedPreset(nextPreset);

    const processing = nextPreset
      ? setAudioTrackSignalEffect(draft.processing, {
          preset: nextPreset,
          stage: "cleanup",
          type: "noiseReduction",
        })
      : removeAudioTrackSignalEffect(draft.processing, "noiseReduction");

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
            {t("audio.noiseReduction.label")}
          </AudioTrackEffectsLibraryPageTitle>
          <AudioTrackEffectsLibraryPageDescription>
            {t("audio.noiseReduction.description")}
          </AudioTrackEffectsLibraryPageDescription>
        </AudioTrackEffectsLibraryPageHeaderContent>
        <AudioTrackEffectsLibraryPageToggle
          aria-label={t("audio.noiseReduction.label")}
          checked={preset !== undefined}
          onCheckedChange={(enabled) => updatePreset(enabled ? selectedPreset : undefined)}
        />
      </AudioTrackEffectsLibraryPageHeader>

      <AudioTrackEffectsLibraryPageContent disabled={preset === undefined}>
        <AudioTrackEffectsLibraryPageBasic className="space-y-4">
          <Label htmlFor={`track-noise-reduction-${streamIndex}`}>
            {t("audio.noiseReduction.strength.label")}
          </Label>
          <Slider
            aria-label={t("audio.noiseReduction.strength.label")}
            aria-valuetext={presetLabels[selectedPresetIndex]}
            id={`track-noise-reduction-${streamIndex}`}
            markers={presetLabels.map((label, value) => ({ label, value }))}
            max={presets.length - 1}
            min={0}
            onDoubleClick={() => updatePreset("medium")}
            onValueChange={([value]) => {
              const nextPreset = presets[value ?? -1];
              if (nextPreset) updatePreset(nextPreset);
            }}
            step={1}
            value={[selectedPresetIndex]}
          />
        </AudioTrackEffectsLibraryPageBasic>
      </AudioTrackEffectsLibraryPageContent>
    </AudioTrackEffectsLibraryPage>
  );
}

export { NoiseReductionPage };

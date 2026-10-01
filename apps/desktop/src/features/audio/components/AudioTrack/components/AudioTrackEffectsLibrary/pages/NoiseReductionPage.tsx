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
  const selectedPreset = preset ?? "medium";
  const presets: readonly NoiseReductionPreset[] = ["light", "medium", "strong"];
  const presetLabels = [
    t("audio.options.noiseReductionLight"),
    t("audio.options.noiseReductionMedium"),
    t("audio.options.noiseReductionStrong"),
  ];

  const selectedPresetIndex = presets.indexOf(selectedPreset);

  const initialPreset = getAudioTrackSignalEffect(
    draft.initialProcessing,
    "noiseReduction",
  )?.preset;

  const updatePreset = (nextPreset: NoiseReductionPreset | undefined) => {
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
        <AudioTrackEffectsLibraryPageBasic className="space-y-4">
          <Label htmlFor={`track-noise-reduction-${streamIndex}`}>
            {t("audio.labels.noiseReductionStrength")}
          </Label>
          <Slider
            aria-label={t("audio.labels.noiseReductionStrength")}
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

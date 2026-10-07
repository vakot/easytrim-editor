import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

import {
  AUDIO_TRACK_HIGH_PASS_CUTOFF_PRESETS,
  getAudioTrackSignalEffect,
  removeAudioTrackSignalEffect,
  setAudioTrackSignalEffect,
} from "@/domain/audio-processing";

import { useAudioTrackEffectsDraft } from "../../AudioTrackEffectsDialog/contexts/audio-track-effects-draft-context";
import {
  AudioTrackEffectsLibraryPage,
  AudioTrackEffectsLibraryPageContent,
  AudioTrackEffectsLibraryPageDescription,
  AudioTrackEffectsLibraryPageHeader,
  AudioTrackEffectsLibraryPageHeaderContent,
  AudioTrackEffectsLibraryPageTitle,
  AudioTrackEffectsLibraryPageToggle,
} from "../components/AudioTrackEffectsLibraryPage";

const DEFAULT_HIGH_PASS_CUTOFF_HZ = 80;
const MIN_HIGH_PASS_CUTOFF_HZ = AUDIO_TRACK_HIGH_PASS_CUTOFF_PRESETS[0];
const MAX_HIGH_PASS_CUTOFF_HZ = AUDIO_TRACK_HIGH_PASS_CUTOFF_PRESETS[3];

function HighPassPage({ streamIndex }: { streamIndex: number }) {
  const { t } = useTranslation();
  const { dispatch, draft } = useAudioTrackEffectsDraft();
  const highPass = getAudioTrackSignalEffect(draft.processing, "highPass", "cleanup");
  const [cutoffHz, setCutoffHz] = useState(() => highPass?.cutoffHz ?? DEFAULT_HIGH_PASS_CUTOFF_HZ);

  const updateHighPass = (enabled: boolean, requestedCutoffHz = cutoffHz) => {
    const processing = enabled
      ? setAudioTrackSignalEffect(draft.processing, {
          cutoffHz: requestedCutoffHz,
          stage: "cleanup",
          type: "highPass",
        })
      : removeAudioTrackSignalEffect(draft.processing, "highPass", "cleanup");

    dispatch({ type: "processingChanged", value: processing });
  };

  const handleCutoffChange = ([value]: number[]) => {
    if (value === undefined) return;
    setCutoffHz(value);
    updateHighPass(true, value);
  };

  return (
    <AudioTrackEffectsLibraryPage>
      <AudioTrackEffectsLibraryPageHeader>
        <AudioTrackEffectsLibraryPageHeaderContent>
          <AudioTrackEffectsLibraryPageTitle>
            {t("audio.highPass.label")}
          </AudioTrackEffectsLibraryPageTitle>
          <AudioTrackEffectsLibraryPageDescription>
            {t("audio.highPass.description")}
          </AudioTrackEffectsLibraryPageDescription>
        </AudioTrackEffectsLibraryPageHeaderContent>
        <AudioTrackEffectsLibraryPageToggle
          aria-label={t("audio.highPass.label")}
          checked={highPass !== undefined}
          onCheckedChange={(enabled) => updateHighPass(enabled)}
        />
      </AudioTrackEffectsLibraryPageHeader>

      <AudioTrackEffectsLibraryPageContent disabled={highPass === undefined}>
        <Label htmlFor={`track-high-pass-cutoff-${streamIndex}`}>
          {t("audio.highPass.cutoffLabel")}
        </Label>
        <div className="mt-2 flex max-w-md items-center gap-3">
          <Slider
            aria-label={t("audio.highPass.cutoffLabel")}
            aria-valuetext={`${cutoffHz} Hz`}
            id={`track-high-pass-cutoff-${streamIndex}`}
            markers={AUDIO_TRACK_HIGH_PASS_CUTOFF_PRESETS.map((preset) => ({
              label: `${preset} Hz`,
              value: preset,
            }))}
            max={MAX_HIGH_PASS_CUTOFF_HZ}
            min={MIN_HIGH_PASS_CUTOFF_HZ}
            onValueChange={handleCutoffChange}
            step={20}
            value={[cutoffHz]}
          />
          <output className="w-12 shrink-0 text-right text-sm text-muted-foreground">
            {cutoffHz} Hz
          </output>
        </div>
      </AudioTrackEffectsLibraryPageContent>
    </AudioTrackEffectsLibraryPage>
  );
}

export { HighPassPage };

import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

import {
  DEFAULT_AUDIO_TRACK_LIMITER_CEILING_DB,
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

const MIN_LIMITER_CEILING_DB = -24;
const MAX_LIMITER_CEILING_DB = 0;

function LimiterPage({ streamIndex }: { streamIndex: number }) {
  const { i18n, t } = useTranslation();
  const { dispatch, draft } = useAudioTrackEffectsDraft();
  const limiter = getAudioTrackSignalEffect(draft.processing, "limiter");
  const [ceilingDb, setCeilingDb] = useState(
    () => limiter?.ceilingDb ?? DEFAULT_AUDIO_TRACK_LIMITER_CEILING_DB,
  );

  const formattedCeilingDb = formatCeilingDb(ceilingDb, i18n.language);

  const updateLimiter = (enabled: boolean, requestedCeilingDb = ceilingDb) => {
    const processing = enabled
      ? setAudioTrackSignalEffect(draft.processing, {
          ceilingDb: requestedCeilingDb,
          stage: "finalProtection",
          type: "limiter",
        })
      : removeAudioTrackSignalEffect(draft.processing, "limiter");

    const initialLimiter = getAudioTrackSignalEffect(draft.initialProcessing, "limiter");
    const nextLimiter = getAudioTrackSignalEffect(processing, "limiter");
    const dirty =
      initialLimiter?.ceilingDb !== nextLimiter?.ceilingDb ||
      (initialLimiter === undefined) !== (nextLimiter === undefined);

    dispatch({ type: "processingChanged", value: processing });
    dispatch({
      dirty,
      effectId: "limiter",
      type: "effectStatusChanged",
      valid: true,
    });
  };

  const handleCeilingChange = ([value]: number[]) => {
    if (value === undefined) return;
    setCeilingDb(value);
    updateLimiter(true, value);
  };

  return (
    <AudioTrackEffectsLibraryPage>
      <AudioTrackEffectsLibraryPageHeader>
        <AudioTrackEffectsLibraryPageHeaderContent>
          <AudioTrackEffectsLibraryPageTitle>
            {t("audio.limiter.label")}
          </AudioTrackEffectsLibraryPageTitle>
          <AudioTrackEffectsLibraryPageDescription>
            {t("audio.limiter.description")}
          </AudioTrackEffectsLibraryPageDescription>
        </AudioTrackEffectsLibraryPageHeaderContent>
        <AudioTrackEffectsLibraryPageToggle
          aria-label={t("audio.limiter.label")}
          checked={limiter !== undefined}
          onCheckedChange={(enabled) => updateLimiter(enabled)}
        />
      </AudioTrackEffectsLibraryPageHeader>

      <AudioTrackEffectsLibraryPageContent disabled={limiter === undefined}>
        <Label htmlFor={`track-limiter-ceiling-${streamIndex}`}>
          {t("audio.limiter.labelCeiling")}
        </Label>
        <div className="mt-2 flex max-w-md items-center gap-3">
          <Slider
            aria-label={t("audio.limiter.labelCeiling")}
            aria-valuetext={`${formattedCeilingDb} dB`}
            id={`track-limiter-ceiling-${streamIndex}`}
            markers={[
              { label: "-24 dB", value: MIN_LIMITER_CEILING_DB },
              { label: "-18 dB", value: -18 },
              { label: "-12 dB", value: -12 },
              { label: "-6 dB", value: -6 },
              { label: "0 dB", value: MAX_LIMITER_CEILING_DB },
            ]}
            max={MAX_LIMITER_CEILING_DB}
            min={MIN_LIMITER_CEILING_DB}
            onDoubleClick={() => {
              setCeilingDb(DEFAULT_AUDIO_TRACK_LIMITER_CEILING_DB);
              updateLimiter(true, DEFAULT_AUDIO_TRACK_LIMITER_CEILING_DB);
            }}
            onValueChange={handleCeilingChange}
            step={1}
            value={[ceilingDb]}
          />
          <output className="w-12 shrink-0 text-right text-sm text-muted-foreground">
            {formattedCeilingDb} dB
          </output>
        </div>
      </AudioTrackEffectsLibraryPageContent>
    </AudioTrackEffectsLibraryPage>
  );
}

function formatCeilingDb(value: number, language: string): string {
  return new Intl.NumberFormat(language, { maximumFractionDigits: 1 })
    .format(value)
    .replace(/-/g, "−");
}

export { LimiterPage };

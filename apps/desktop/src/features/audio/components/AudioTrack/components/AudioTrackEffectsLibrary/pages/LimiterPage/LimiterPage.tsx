import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  DEFAULT_AUDIO_TRACK_LIMITER_CEILING_DB,
  getAudioTrackSignalEffect,
  removeAudioTrackSignalEffect,
  setAudioTrackSignalEffect,
} from "@/domain/audio-processing";

import { useAudioTrackEffectsDraft } from "../../../AudioTrackEffectsDialog/contexts/audio-track-effects-draft-context";
import {
  AudioTrackEffectsLibraryPage,
  AudioTrackEffectsLibraryPageContent,
  AudioTrackEffectsLibraryPageDescription,
  AudioTrackEffectsLibraryPageHeader,
  AudioTrackEffectsLibraryPageHeaderContent,
  AudioTrackEffectsLibraryPageTitle,
  AudioTrackEffectsLibraryPageToggle,
} from "../../components/AudioTrackEffectsLibraryPage";

const MIN_LIMITER_CEILING_DB = -24;
const MAX_LIMITER_CEILING_DB = 0;

function LimiterPage({ streamIndex }: { streamIndex: number }) {
  const { t } = useTranslation();
  const { dispatch, draft } = useAudioTrackEffectsDraft();
  const limiter = getAudioTrackSignalEffect(draft.processing, "limiter");
  const [ceilingInput, setCeilingInput] = useState(() =>
    String(limiter?.ceilingDb ?? DEFAULT_AUDIO_TRACK_LIMITER_CEILING_DB),
  );

  const ceilingDb = parseLimiterCeiling(ceilingInput);
  const valid = ceilingDb !== null;

  const updateLimiter = (enabled: boolean, requestedCeilingDb = ceilingDb) => {
    const nextCeilingDb =
      enabled && requestedCeilingDb === null
        ? DEFAULT_AUDIO_TRACK_LIMITER_CEILING_DB
        : requestedCeilingDb;

    if (enabled && requestedCeilingDb === null) setCeilingInput(String(nextCeilingDb));

    const processing = enabled
      ? setAudioTrackSignalEffect(draft.processing, {
          ceilingDb: nextCeilingDb ?? DEFAULT_AUDIO_TRACK_LIMITER_CEILING_DB,
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
      dirty: dirty || (enabled && nextCeilingDb === null),
      effectId: "limiter",
      type: "effectStatusChanged",
      valid: !enabled || nextCeilingDb !== null,
    });
  };

  const handleCeilingChange = (value: string) => {
    setCeilingInput(value);
    const nextCeilingDb = parseLimiterCeiling(value);
    if (nextCeilingDb === null) {
      dispatch({
        dirty: true,
        effectId: "limiter",
        type: "effectStatusChanged",
        valid: false,
      });
      return;
    }
    updateLimiter(true, nextCeilingDb);
  };

  return (
    <AudioTrackEffectsLibraryPage>
      <AudioTrackEffectsLibraryPageHeader>
        <AudioTrackEffectsLibraryPageHeaderContent>
          <AudioTrackEffectsLibraryPageTitle>
            {t("audio.labels.limiter")}
          </AudioTrackEffectsLibraryPageTitle>
          <AudioTrackEffectsLibraryPageDescription>
            {t("audio.messages.limiterDescription")}
          </AudioTrackEffectsLibraryPageDescription>
        </AudioTrackEffectsLibraryPageHeaderContent>
        <AudioTrackEffectsLibraryPageToggle
          aria-label={t("audio.labels.limiter")}
          checked={limiter !== undefined}
          onCheckedChange={(enabled) => updateLimiter(enabled)}
        />
      </AudioTrackEffectsLibraryPageHeader>

      <AudioTrackEffectsLibraryPageContent disabled={limiter === undefined}>
        <div className="grid gap-1.5">
          <Label htmlFor={`track-limiter-ceiling-${streamIndex}`}>
            {t("audio.labels.limiterCeiling")}
          </Label>
          <div className="flex max-w-48 items-center gap-2">
            <Input
              aria-invalid={limiter !== undefined && !valid}
              id={`track-limiter-ceiling-${streamIndex}`}
              max={MAX_LIMITER_CEILING_DB}
              min={MIN_LIMITER_CEILING_DB}
              onChange={(event) => handleCeilingChange(event.currentTarget.value)}
              step="0.5"
              type="number"
              value={ceilingInput}
            />
            <span aria-hidden="true" className="text-sm text-muted-foreground">
              dB
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("audio.messages.limiterCeilingDescription")}
          </p>
        </div>
      </AudioTrackEffectsLibraryPageContent>
    </AudioTrackEffectsLibraryPage>
  );
}

function parseLimiterCeiling(value: string): number | null {
  if (!value.trim()) return null;
  const ceilingDb = Number(value);
  return Number.isFinite(ceilingDb) &&
    ceilingDb >= MIN_LIMITER_CEILING_DB &&
    ceilingDb <= MAX_LIMITER_CEILING_DB
    ? ceilingDb
    : null;
}

export { LimiterPage };

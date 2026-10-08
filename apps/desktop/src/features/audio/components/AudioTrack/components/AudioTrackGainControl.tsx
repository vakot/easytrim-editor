import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import { audioTrackGainChanged, selectAudioTracks } from "@/app/store/slices/audio-slice";
import { commitActiveEditingInstanceDraft } from "@/app/store/thunks/source-media-thunks";
import { loudnessNormalizationTargets } from "@/domain/audio-processing";
import { useAudioPlayback } from "@/features/audio";

import { formatGain } from "../../../lib/audio-level.utils";

const MIN_GAIN_DB_SLIDER = -24;
const MAX_GAIN_DB_SLIDER = 12;
const MIN_GAIN_DB = -60;
const MAX_GAIN_DB = 24;

function AudioTrackGainControl({
  onLiveGainChange,
  streamIndex,
  trackNumber,
}: {
  onLiveGainChange: (gainDb: number | null) => void;
  streamIndex: number;
  trackNumber: number;
}) {
  const { i18n, t } = useTranslation();
  const dispatch = useAppDispatch();
  const { clearLiveAudioTrackGain, setLiveAudioTrackGain } = useAudioPlayback();
  const track = useAppSelector((state) =>
    selectAudioTracks(state).find((candidate) => candidate.streamIndex === streamIndex),
  );

  const [draftGainDb, setDraftGainDb] = useState<number | null>(null);
  const gainDb = draftGainDb ?? track?.processing.gainDb ?? 0;

  const [editing, setEditing] = useState(false);

  useEffect(
    () => () => {
      clearLiveAudioTrackGain(streamIndex);
      onLiveGainChange(null);
    },
    [clearLiveAudioTrackGain, onLiveGainChange, streamIndex],
  );

  const updateGain = (gainDb: number) => {
    setDraftGainDb(gainDb);
    onLiveGainChange(gainDb);
    setLiveAudioTrackGain(streamIndex, gainDb);
  };

  const commitGain = (gainDb: number) => {
    const gainChanged = track?.processing.gainDb !== gainDb;

    if (gainChanged) {
      dispatch(audioTrackGainChanged({ gainDb, streamIndex }));
    }

    if (gainChanged) dispatch(commitActiveEditingInstanceDraft());

    clearLiveAudioTrackGain(streamIndex);
    onLiveGainChange(null);
    setDraftGainDb(null);
  };

  if (!track) return null;

  const normalization = track.processing.loudnessNormalization;

  if (!normalization) {
    return (
      <div className="p-2">
        {editing ? (
          <AudioTrackGainInput
            commitGain={commitGain}
            gainDb={gainDb}
            setEditing={setEditing}
            trackNumber={trackNumber}
            updateGain={updateGain}
          />
        ) : (
          <AudioTrackGainSlider
            commitGain={commitGain}
            gainDb={gainDb}
            setEditing={setEditing}
            trackNumber={trackNumber}
            updateGain={updateGain}
          />
        )}
      </div>
    );
  }

  const { maxTruePeakDb, targetLufs } = loudnessNormalizationTargets(normalization);
  const numberFormatter = new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 });
  const levelSummary = t("audio.normalization.levelSummary", {
    peak: numberFormatter.format(maxTruePeakDb).replace(/-/g, "−"),
    target: numberFormatter.format(targetLufs).replace(/-/g, "−"),
  });

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex size-full h-12 items-center justify-center p-4 text-xs text-muted-foreground">
          {levelSummary}
        </div>
      </TooltipTrigger>
      <TooltipContent>{t("audio.normalization.manualGainUnavailable")}</TooltipContent>
    </Tooltip>
  );
}

function AudioTrackGainSlider({
  commitGain,
  gainDb,
  setEditing,
  trackNumber,
  updateGain,
}: {
  commitGain: (gainDb: number) => void;
  gainDb: number;
  setEditing: (editing: boolean) => void;
  trackNumber: number;
  updateGain: (gainDb: number) => void;
}) {
  const { i18n, t } = useTranslation();

  return (
    <div className="flex h-8 min-w-0 items-center gap-1.5 pt-2">
      <Slider
        aria-label={t("audio.tracks.gainLabel", { number: trackNumber })}
        className="min-w-0 flex-1 py-0 **:data-[slot=slider-thumb]:size-2.5"
        markers={[
          { label: MIN_GAIN_DB_SLIDER, value: MIN_GAIN_DB_SLIDER },
          { label: "0", value: 0 },
          { label: MAX_GAIN_DB_SLIDER, value: MAX_GAIN_DB_SLIDER },
        ]}
        max={MAX_GAIN_DB_SLIDER}
        min={MIN_GAIN_DB_SLIDER}
        onDoubleClick={() => commitGain(0)}
        onValueChange={([gainDb]) => {
          if (gainDb !== undefined) updateGain(gainDb);
        }}
        onValueCommit={([gainDb]) => {
          if (gainDb !== undefined) commitGain(gainDb);
        }}
        step={0.5}
        value={[gainDb]}
      />
      <Button
        className="h-auto w-[7ch] shrink-0 justify-end p-0 text-xs leading-none font-normal text-muted-foreground tabular-nums"
        onClick={() => setEditing(true)}
        size="sm"
        variant="link"
      >
        <output>{formatGain(gainDb, i18n.language)}</output>
      </Button>
    </div>
  );
}

function AudioTrackGainInput({
  commitGain,
  gainDb,
  setEditing,
  trackNumber,
  updateGain,
}: {
  commitGain: (gainDb: number) => void;
  gainDb: number;
  setEditing: (editing: boolean) => void;
  trackNumber: number;
  updateGain: (gainDb: number) => void;
}) {
  const { t } = useTranslation();
  const [value, setValue] = useState(String(gainDb));

  const commit = () => {
    const parsed = Number(value);

    commitGain(
      value.trim() && Number.isFinite(parsed)
        ? Math.max(MIN_GAIN_DB, Math.min(MAX_GAIN_DB, parsed))
        : gainDb,
    );

    setEditing(false);
  };

  return (
    <Input
      aria-label={t("audio.tracks.gainLabel", { number: trackNumber })}
      autoFocus
      max={MAX_GAIN_DB}
      min={MIN_GAIN_DB}
      onBlur={commit}
      onChange={(event) => {
        const nextValue = event.target.value;
        setValue(nextValue);
        const num = Number(nextValue);
        if (nextValue.trim() && Number.isFinite(num)) {
          updateGain(num);
        }
      }}
      onFocus={(event) => event.target.select()}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.currentTarget.blur();
        }

        if (event.key === "Escape") {
          setValue(String(gainDb));
          event.currentTarget.blur();
        }
      }}
      step={0.1}
      type="number"
      value={value}
    />
  );
}

export { AudioTrackGainControl };

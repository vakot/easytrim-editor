import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import { audioTrackGainChanged, selectAudioTracks } from "@/app/store/slices/audio-slice";
import { commitActiveEditingInstanceDraft } from "@/app/store/thunks/source-media-thunks";
import { useAudioPlayback } from "@/features/audio";

import { formatGain, MIN_SLIDER_DECIBELS } from "../../../lib/audio-level.utils";

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
  const gainSliderDb = draftGainDb ?? (track?.processing.gainDb ?? 0);
  const manualGainUnavailable = track?.processing.loudnessNormalization !== undefined;

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

  const gainSlider = (
    <Slider
      aria-label={t("audio.tracks.gainLabel", { number: trackNumber })}
      className="min-w-0 flex-1 py-0 **:data-[slot=slider-thumb]:size-2.5"
      disabled={manualGainUnavailable}
      markers={[
        { label: "−60 dB", value: MIN_SLIDER_DECIBELS },
        { label: "0 dB", value: 0 },
      ]}
      max={12}
      min={MIN_SLIDER_DECIBELS}
      onDoubleClick={manualGainUnavailable ? undefined : () => commitGain(0)}
      onValueChange={([gainDb]) => {
        if (gainDb !== undefined) updateGain(gainDb);
      }}
      onValueCommit={([gainDb]) => {
        if (gainDb !== undefined) commitGain(gainDb);
      }}
      step={0.5}
      value={[gainSliderDb]}
    />
  );

  return (
    <div className="flex h-4 min-w-0 items-center gap-1.5">
      {manualGainUnavailable ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="min-w-0 flex-1">{gainSlider}</div>
          </TooltipTrigger>
          <TooltipContent>{t("audio.normalization.manualGainUnavailable")}</TooltipContent>
        </Tooltip>
      ) : (
        gainSlider
      )}
      <output className="w-[7ch] shrink-0 text-right text-xs leading-none text-muted-foreground">
        {formatGain(gainSliderDb, i18n.language)}
      </output>
    </div>
  );
}

export { AudioTrackGainControl };

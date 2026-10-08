import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Slider } from "@/components/ui/slider";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  audioTrackGainChanged,
  audioTrackToggled,
  selectAudioTracks,
} from "@/app/store/slices/audio-slice";
import { commitActiveEditingInstanceDraft } from "@/app/store/thunks/source-media-thunks";
import { useAudioPlayback } from "@/features/audio";

import { formatGain, MIN_SLIDER_DECIBELS } from "../../../lib/audio-level.utils";

function AudioTrackGainControl({
  onLiveGainChange,
  streamIndex,
  trackNumber,
}: {
  onLiveGainChange: (draft: { enabled: boolean; gainDb: number } | null) => void;
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
  const gainSliderDb =
    draftGainDb ?? (track?.enabled ? (track.processing.gainDb ?? 0) : MIN_SLIDER_DECIBELS);

  useEffect(
    () => () => {
      clearLiveAudioTrackGain(streamIndex);
      onLiveGainChange(null);
    },
    [clearLiveAudioTrackGain, onLiveGainChange, streamIndex],
  );

  const updateGain = (gainDb: number) => {
    const enabled = gainDb > MIN_SLIDER_DECIBELS;

    setDraftGainDb(gainDb);
    onLiveGainChange({ enabled, gainDb });
    setLiveAudioTrackGain(streamIndex, enabled ? gainDb : Number.NEGATIVE_INFINITY);
  };

  const commitGain = (gainDb: number) => {
    const enabled = gainDb > MIN_SLIDER_DECIBELS;
    const gainChanged = track?.processing.gainDb !== gainDb;
    const enabledChanged = track?.enabled !== enabled;

    if (gainChanged) {
      dispatch(audioTrackGainChanged({ gainDb, streamIndex }));
    }

    if (enabledChanged) {
      dispatch(audioTrackToggled({ streamIndex }));
    }

    if (gainChanged || enabledChanged) {
      dispatch(commitActiveEditingInstanceDraft());
    }

    clearLiveAudioTrackGain(streamIndex);
    onLiveGainChange(null);
    setDraftGainDb(null);
  };

  return (
    <div className="flex h-4 min-w-0 items-center gap-1.5">
      <Slider
        aria-label={t("audio.tracks.gainLabel", { number: trackNumber })}
        className="min-w-0 flex-1 py-0 **:data-[slot=slider-thumb]:size-2.5"
        markers={[
          { label: "−∞", value: MIN_SLIDER_DECIBELS },
          { label: "0 dB", value: 0 },
        ]}
        max={12}
        min={MIN_SLIDER_DECIBELS}
        onDoubleClick={() => commitGain(0)}
        onValueChange={([gainDb]) => {
          if (gainDb !== undefined) updateGain(gainDb);
        }}
        onValueCommit={([gainDb]) => {
          if (gainDb !== undefined) commitGain(gainDb);
        }}
        step={0.5}
        value={[gainSliderDb]}
      />
      <output className="w-[7ch] shrink-0 text-right text-xs leading-none text-muted-foreground">
        {formatGain(gainSliderDb, i18n.language)}
      </output>
    </div>
  );
}

export { AudioTrackGainControl };

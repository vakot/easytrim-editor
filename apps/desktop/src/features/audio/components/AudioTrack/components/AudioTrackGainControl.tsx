import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import { audioTrackGainChanged, selectAudioTracks } from "@/app/store/slices/audio-slice";
import { commitActiveEditingInstanceDraft } from "@/app/store/thunks/source-media-thunks";

import { useAudioPlaybackAdapter } from "../../../contexts/audio-transport-context";
import { formatGain } from "../../../lib/audio-level.utils";

const MIN_GAIN_DB_SLIDER = -24;
const MAX_GAIN_DB_SLIDER = 12;
const MIN_GAIN_DB = -60;
const MAX_GAIN_DB = 24;

function clampGainDb(gainDb: number) {
  return Math.max(MIN_GAIN_DB, Math.min(MAX_GAIN_DB, gainDb));
}

function AudioTrackGainControl({
  onLiveGainChange,
  streamIndex,
  trackNumber,
}: {
  onLiveGainChange: (gainDb: number | null) => void;
  streamIndex: number;
  trackNumber: number;
}) {
  const dispatch = useAppDispatch();
  const { setLiveTrackGain } = useAudioPlaybackAdapter();
  const track = useAppSelector((state) =>
    selectAudioTracks(state).find((candidate) => candidate.streamIndex === streamIndex),
  );

  const [draftGainDb, setDraftGainDb] = useState<number | null>(null);
  const gainDb = draftGainDb ?? track?.processing.gainDb ?? 0;

  const [editing, setEditing] = useState(false);

  useEffect(
    () => () => {
      setLiveTrackGain(streamIndex, null);
      onLiveGainChange(null);
    },
    [onLiveGainChange, setLiveTrackGain, streamIndex],
  );

  const updateGain = (gainDb: number) => {
    setDraftGainDb(gainDb);
    onLiveGainChange(gainDb);
    setLiveTrackGain(streamIndex, gainDb);
  };

  const commitGain = (gainDb: number) => {
    if (track?.processing.gainDb !== gainDb) {
      // The committed gain reaches playback through the track settings.
      dispatch(audioTrackGainChanged({ gainDb, streamIndex }));
      dispatch(commitActiveEditingInstanceDraft());
    } else {
      setLiveTrackGain(streamIndex, null);
    }

    onLiveGainChange(null);
    setDraftGainDb(null);
  };

  const cancelGain = () => {
    setLiveTrackGain(streamIndex, null);
    onLiveGainChange(null);
    setDraftGainDb(null);
  };

  if (!track) return null;

  return (
    <div className="p-2">
      {editing ? (
        <AudioTrackGainInput
          cancelGain={cancelGain}
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
  cancelGain,
  commitGain,
  gainDb,
  setEditing,
  trackNumber,
  updateGain,
}: {
  cancelGain: () => void;
  commitGain: (gainDb: number) => void;
  gainDb: number;
  setEditing: (editing: boolean) => void;
  trackNumber: number;
  updateGain: (gainDb: number) => void;
}) {
  const { t } = useTranslation();
  const initialGainDb = useRef(gainDb);
  const [value, setValue] = useState(String(gainDb));

  const commit = () => {
    const parsed = Number(value);

    commitGain(value.trim() && Number.isFinite(parsed) ? clampGainDb(parsed) : gainDb);

    setEditing(false);
  };

  return (
    <Input
      aria-label={t("audio.tracks.gainLabel", { number: trackNumber })}
      aria-valuemax={MAX_GAIN_DB}
      aria-valuemin={MIN_GAIN_DB}
      aria-valuenow={gainDb}
      autoFocus
      inputMode="decimal"
      onBlur={commit}
      onChange={(event) => {
        const nextValue = event.target.value;
        setValue(nextValue);
        const num = Number(nextValue);
        if (nextValue.trim() && Number.isFinite(num)) {
          updateGain(clampGainDb(num));
        }
      }}
      onFocus={(event) => event.target.select()}
      onKeyDown={(event) => {
        if (event.key === "ArrowUp" || event.key === "ArrowDown") {
          event.preventDefault();
          const parsed = Number(value);
          const currentGainDb = value.trim() && Number.isFinite(parsed) ? parsed : gainDb;
          const direction = event.key === "ArrowUp" ? 1 : -1;
          const nextGainDb = clampGainDb(Number((currentGainDb + direction * 0.1).toFixed(1)));
          setValue(String(nextGainDb));
          updateGain(nextGainDb);
        }

        if (event.key === "Enter") {
          event.currentTarget.blur();
        }

        if (event.key === "Escape") {
          event.preventDefault();
          setValue(String(initialGainDb.current));
          cancelGain();
          setEditing(false);
        }
      }}
      role="spinbutton"
      type="text"
      value={value}
    />
  );
}

export { AudioTrackGainControl };

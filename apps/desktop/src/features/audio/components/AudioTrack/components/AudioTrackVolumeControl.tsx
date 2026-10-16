import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Slider } from "@/components/ui/slider";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import { audioTrackVolumeChanged, selectAudioTracks } from "@/app/store/slices/audio-slice";
import { commitActiveEditingInstanceDraft } from "@/app/store/thunks/source-media-thunks";
import {
  clampTrackVolume,
  DEFAULT_TRACK_VOLUME,
  MAX_TRACK_VOLUME,
  TRACK_VOLUME_SLIDER_MAX,
} from "@/domain/audio-processing";

import { useAudioPlaybackAdapter } from "../../../contexts/audio-transport-context";
import { formatTrackVolume } from "../../../lib/audio-level.utils";

const SLIDER_MAX_PERCENT = TRACK_VOLUME_SLIDER_MAX * 100;
const MAX_PERCENT = MAX_TRACK_VOLUME * 100;

function AudioTrackVolumeControl({
  onLiveVolumeChange,
  streamIndex,
  trackNumber,
}: {
  onLiveVolumeChange: (volume: number | null) => void;
  streamIndex: number;
  trackNumber: number;
}) {
  const dispatch = useAppDispatch();
  const { setLiveTrackVolume } = useAudioPlaybackAdapter();
  const track = useAppSelector((state) =>
    selectAudioTracks(state).find((candidate) => candidate.streamIndex === streamIndex),
  );

  const [draftVolume, setDraftVolume] = useState<number | null>(null);
  const volume = draftVolume ?? track?.processing.volume ?? DEFAULT_TRACK_VOLUME;

  const [editing, setEditing] = useState(false);

  useEffect(
    () => () => {
      setLiveTrackVolume(streamIndex, null);
      onLiveVolumeChange(null);
    },
    [onLiveVolumeChange, setLiveTrackVolume, streamIndex],
  );

  const updateVolume = (volume: number) => {
    setDraftVolume(volume);
    onLiveVolumeChange(volume);
    setLiveTrackVolume(streamIndex, volume);
  };

  const commitVolume = (volume: number) => {
    if (track?.processing.volume !== volume) {
      // The committed volume reaches playback through the track settings.
      dispatch(audioTrackVolumeChanged({ streamIndex, volume }));
      dispatch(commitActiveEditingInstanceDraft());
    } else {
      setLiveTrackVolume(streamIndex, null);
    }

    onLiveVolumeChange(null);
    setDraftVolume(null);
  };

  const cancelVolume = () => {
    setLiveTrackVolume(streamIndex, null);
    onLiveVolumeChange(null);
    setDraftVolume(null);
  };

  if (!track) return null;

  return editing ? (
    <AudioTrackVolumeInput
      cancelVolume={cancelVolume}
      commitVolume={commitVolume}
      setEditing={setEditing}
      trackNumber={trackNumber}
      updateVolume={updateVolume}
      volume={volume}
    />
  ) : (
    <AudioTrackVolumeSlider
      cancelVolume={cancelVolume}
      commitVolume={commitVolume}
      setEditing={setEditing}
      trackNumber={trackNumber}
      updateVolume={updateVolume}
      volume={volume}
    />
  );
}

function AudioTrackVolumeSlider({
  cancelVolume,
  commitVolume,
  setEditing,
  trackNumber,
  updateVolume,
  volume,
}: {
  cancelVolume: () => void;
  commitVolume: (volume: number) => void;
  setEditing: (editing: boolean) => void;
  trackNumber: number;
  updateVolume: (volume: number) => void;
  volume: number;
}) {
  const { i18n, t } = useTranslation();

  return (
    <div className="flex items-center gap-1 p-2.5">
      <Slider
        aria-label={t("audio.tracks.volumeLabel", { number: trackNumber })}
        aria-valuetext={formatTrackVolume(volume, i18n.language)}
        max={SLIDER_MAX_PERCENT}
        min={0}
        onDoubleClick={() => commitVolume(DEFAULT_TRACK_VOLUME)}
        onValueChange={([percent]) => {
          if (percent !== undefined) updateVolume(percent / 100);
        }}
        onValueCommit={([percent]) => {
          // A volume above the slider range is shown at its end; releasing the slider there
          // without moving it keeps the entered value instead of clamping it.
          if (
            percent === undefined ||
            (volume > TRACK_VOLUME_SLIDER_MAX && percent === SLIDER_MAX_PERCENT)
          ) {
            cancelVolume();
            return;
          }
          commitVolume(percent / 100);
        }}
        step={1}
        value={[Math.min(volume * 100, SLIDER_MAX_PERCENT)]}
      />
      <Button
        className="h-auto w-[5ch] shrink-0 justify-end p-0 text-right text-xs font-normal text-muted-foreground tabular-nums"
        onClick={() => setEditing(true)}
        size="sm"
        variant="link"
      >
        <output>{formatTrackVolume(volume, i18n.language)}</output>
      </Button>
    </div>
  );
}

function parsePercent(value: string): number | null {
  const parsed = Number(value.replace("%", "").replace(",", ".").trim());
  return value.trim() && Number.isFinite(parsed) ? parsed : null;
}

function AudioTrackVolumeInput({
  cancelVolume,
  commitVolume,
  setEditing,
  trackNumber,
  updateVolume,
  volume,
}: {
  cancelVolume: () => void;
  commitVolume: (volume: number) => void;
  setEditing: (editing: boolean) => void;
  trackNumber: number;
  updateVolume: (volume: number) => void;
  volume: number;
}) {
  const { t } = useTranslation();
  const percent = Number((volume * 100).toFixed(1));
  const initialPercent = useRef(percent);
  const [value, setValue] = useState(String(percent));

  const commit = () => {
    const parsed = parsePercent(value);
    commitVolume(parsed === null ? volume : clampTrackVolume(parsed / 100));
    setEditing(false);
  };

  return (
    <InputGroup>
      <InputGroupInput
        aria-label={t("audio.tracks.volumeLabel", { number: trackNumber })}
        aria-valuemax={MAX_PERCENT}
        aria-valuemin={0}
        aria-valuenow={percent}
        autoFocus
        inputMode="decimal"
        onBlur={commit}
        onChange={(event) => {
          const nextValue = event.target.value;
          setValue(nextValue);
          const parsed = parsePercent(nextValue);
          if (parsed !== null) updateVolume(clampTrackVolume(parsed / 100));
        }}
        onFocus={(event) => event.target.select()}
        onKeyDown={(event) => {
          if (event.key === "ArrowUp" || event.key === "ArrowDown") {
            event.preventDefault();
            const currentPercent = parsePercent(value) ?? percent;
            const direction = event.key === "ArrowUp" ? 1 : -1;
            const nextVolume = clampTrackVolume((Math.round(currentPercent) + direction) / 100);
            setValue(String(Math.round(nextVolume * 100)));
            updateVolume(nextVolume);
          }

          if (event.key === "Enter") {
            event.currentTarget.blur();
          }

          if (event.key === "Escape") {
            event.preventDefault();
            setValue(String(initialPercent.current));
            cancelVolume();
            setEditing(false);
          }
        }}
        role="spinbutton"
        type="text"
        value={value}
      />
      <InputGroupAddon align="inline-start">%</InputGroupAddon>
    </InputGroup>
  );
}

export { AudioTrackVolumeControl };

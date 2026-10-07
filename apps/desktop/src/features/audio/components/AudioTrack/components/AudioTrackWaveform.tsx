import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { useAppDispatch } from "@/app/store/redux-hooks";
import { type AudioTrackState, waveformDisplayFailed } from "@/app/store/slices/audio-slice";
import { localizeAppError } from "@/i18n/app-errors";
import type { AudioStream } from "@/lib/tauri/media.types";

import { useWaveformPrepare } from "../../../hooks/useWaveformPreparation";

interface AudioTrackWaveformProps {
  gainDb: number;
  stream: AudioStream;
  track: AudioTrackState;
}

type WaveformWithStatus<Status extends AudioTrackState["waveform"]["status"]> = Extract<
  AudioTrackState["waveform"],
  { status: Status }
>;

function AudioTrackWaveform({ gainDb, stream, track }: AudioTrackWaveformProps) {
  switch (track.waveform.status) {
    case "idle":
    case "loading":
      return <AudioTrackWaveformLoading />;
    case "ready":
      return <AudioTrackWaveformImage gainDb={gainDb} stream={stream} waveform={track.waveform} />;
    case "failed":
      return <AudioTrackWaveformError stream={stream} waveform={track.waveform} />;
  }
}

function AudioTrackWaveformLoading() {
  const { t } = useTranslation();

  return (
    <span
      className="absolute inset-0 grid place-items-center text-xs text-muted-foreground"
      role="status"
    >
      {t("audio.waveform.preparing")}
    </span>
  );
}

function AudioTrackWaveformImage({
  gainDb,
  stream,
  waveform,
}: {
  gainDb: number;
  stream: AudioStream;
  waveform: WaveformWithStatus<"ready">;
}) {
  const dispatch = useAppDispatch();

  return (
    <img
      alt=""
      aria-hidden="true"
      className="waveform-image absolute inset-0 size-full object-fill"
      draggable={false}
      onError={() => void dispatch(waveformDisplayFailed(stream))}
      src={waveform.url}
      style={{
        transform: `scaleY(${waveformVisualScale(gainDb)})`,
        transformOrigin: "center",
      }}
    />
  );
}

function waveformVisualScale(gainDb: number): number {
  return 10 ** (gainDb / 20);
}

function AudioTrackWaveformError({
  stream,
  waveform,
}: {
  stream: AudioStream;
  waveform: WaveformWithStatus<"failed">;
}) {
  const { t } = useTranslation();

  const prepare = useWaveformPrepare(stream.streamIndex, waveform);

  return (
    <div className="absolute inset-0 flex items-center justify-center gap-2 text-xs text-muted-foreground">
      <Tooltip>
        <TooltipTrigger asChild>
          <span>{t("audio.waveform.unavailable")}</span>
        </TooltipTrigger>
        <TooltipContent>{localizeAppError(waveform.error, t)}</TooltipContent>
      </Tooltip>

      <Button onClick={prepare} size="xs" type="button" variant="ghost">
        {t("common.actions.retry")}
      </Button>
    </div>
  );
}

export { AudioTrackWaveform };

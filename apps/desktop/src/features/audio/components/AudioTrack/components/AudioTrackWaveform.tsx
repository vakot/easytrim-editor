import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { useAppDispatch } from "@/app/store/redux-hooks";
import { type AudioTrackState, waveformDisplayFailed } from "@/app/store/slices/audio-slice";
import type { AudioStream } from "@/lib/tauri/media.types";

import { useWaveformPrepare } from "../../../hooks/useWaveformPreparation";

interface AudioTrackWaveformProps {
  stream: AudioStream;
  track: AudioTrackState;
}

type WaveformWithStatus<Status extends AudioTrackState["waveform"]["status"]> = Extract<
  AudioTrackState["waveform"],
  { status: Status }
>;

function AudioTrackWaveform({ stream, track }: AudioTrackWaveformProps) {
  switch (track.waveform.status) {
    case "idle":
    case "loading":
      return <AudioTrackWaveformLoading />;
    case "ready":
      return <AudioTrackWaveformImage stream={stream} waveform={track.waveform} />;
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
      {t("audio.status.preparingWaveform")}
    </span>
  );
}

function AudioTrackWaveformImage({
  stream,
  waveform,
}: {
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
    />
  );
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
          <span>{t("audio.status.waveformUnavailable")}</span>
        </TooltipTrigger>
        <TooltipContent>{waveform.error.message}</TooltipContent>
      </Tooltip>

      <Button onClick={prepare} size="xs" type="button" variant="ghost">
        {t("common.actions.retry")}
      </Button>
    </div>
  );
}

export { AudioTrackWaveform };

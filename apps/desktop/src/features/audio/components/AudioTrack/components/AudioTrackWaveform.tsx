import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
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
      return (
        <AudioTrackWaveformCanvas
          gainDb={gainDb}
          key={track.waveform.url}
          muted={!track.enabled}
          stream={stream}
          waveform={track.waveform}
        />
      );
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

interface WaveformEnvelope {
  amplitudes: Uint8Array;
  width: number;
}

const WAVEFORM_HEADER_SIZE = 12;
const WAVEFORM_FORMAT_VERSION = 1;
const WAVEFORM_FLAG_RLE = 1;
const WAVEFORM_MAX_AMPLITUDE = 255;

function AudioTrackWaveformCanvas({
  gainDb,
  muted,
  stream,
  waveform,
}: {
  gainDb: number;
  muted: boolean;
  stream: AudioStream;
  waveform: WaveformWithStatus<"ready">;
}) {
  const dispatch = useAppDispatch();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const envelopeRef = useRef<WaveformEnvelope | null>(null);
  const drawRef = useRef<() => void>(() => undefined);
  const [envelopeReady, setEnvelopeReady] = useState(false);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const envelope = envelopeRef.current;
    if (!canvas || !envelope) return;

    const bounds = canvas.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return;

    const pixelRatio = Math.max(window.devicePixelRatio || 1, 1);
    const pixelWidth = Math.max(1, Math.round(bounds.width * pixelRatio));
    const pixelHeight = Math.max(1, Math.round(bounds.height * pixelRatio));
    if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
    if (canvas.height !== pixelHeight) canvas.height = pixelHeight;

    const context = canvas.getContext("2d");
    if (!context) return;

    context.clearRect(0, 0, pixelWidth, pixelHeight);
    if (muted) return;

    const gain = 10 ** (gainDb / 20);
    const centerY = pixelHeight / 2;
    context.strokeStyle = "#8b5cf6";
    context.lineWidth = 1;
    context.beginPath();

    for (let x = 0; x < pixelWidth; x += 1) {
      const start = Math.floor((x * envelope.width) / pixelWidth);
      const end = Math.max(start + 1, Math.ceil(((x + 1) * envelope.width) / pixelWidth));
      let amplitude = 0;
      for (let bin = start; bin < Math.min(end, envelope.width); bin += 1) {
        amplitude = Math.max(amplitude, envelope.amplitudes[bin] ?? 0);
      }

      const normalized = Math.min(1, (amplitude / WAVEFORM_MAX_AMPLITUDE) * gain);
      const halfHeight = normalized * centerY;
      if (halfHeight > 0) {
        context.moveTo(x + 0.5, centerY - halfHeight);
        context.lineTo(x + 0.5, centerY + halfHeight);
      }
    }
    context.stroke();
  }, [gainDb, muted]);

  useEffect(() => {
    envelopeRef.current = null;
    let active = true;
    const controller = new AbortController();

    void fetch(waveform.url, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Waveform envelope request failed.");
        return response.arrayBuffer();
      })
      .then((buffer) => {
        const envelope = parseWaveformEnvelope(buffer, waveform.width);
        if (!active) return;
        envelopeRef.current = envelope;
        setEnvelopeReady(true);
      })
      .catch(() => {
        if (active) void dispatch(waveformDisplayFailed(stream));
      });

    return () => {
      active = false;
      controller.abort();
      envelopeRef.current = null;
    };
  }, [dispatch, stream, waveform.url, waveform.width]);

  useLayoutEffect(() => {
    drawRef.current = draw;
    if (envelopeReady) draw();
  }, [draw, envelopeReady]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handleResize = () => drawRef.current();
    window.addEventListener("resize", handleResize);
    if (typeof ResizeObserver === "undefined") {
      return () => window.removeEventListener("resize", handleResize);
    }
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(canvas);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", handleResize);
    };
  }, [waveform.url]);

  return <canvas aria-hidden="true" className="absolute inset-0 size-full" ref={canvasRef} />;
}

function parseWaveformEnvelope(buffer: ArrayBuffer, expectedWidth: number): WaveformEnvelope {
  if (buffer.byteLength < WAVEFORM_HEADER_SIZE) throw new Error("Waveform header is missing.");
  const view = new DataView(buffer);
  if (
    view.getUint8(0) !== 0x45 ||
    view.getUint8(1) !== 0x54 ||
    view.getUint8(2) !== 0x57 ||
    view.getUint8(3) !== 0x46 ||
    view.getUint16(4, true) !== WAVEFORM_FORMAT_VERSION
  ) {
    throw new Error("Waveform format is unsupported.");
  }

  const flags = view.getUint16(6, true);
  const width = view.getUint32(8, true);
  if (width !== expectedWidth || flags & ~WAVEFORM_FLAG_RLE) {
    throw new Error("Waveform envelope size is invalid.");
  }

  const payload = new Uint8Array(buffer, WAVEFORM_HEADER_SIZE);
  const amplitudes = flags & WAVEFORM_FLAG_RLE ? decodeRle(payload, width) : payload;
  if (amplitudes.length !== width) throw new Error("Waveform envelope size is invalid.");
  return { amplitudes, width };
}

function decodeRle(payload: Uint8Array, width: number): Uint8Array {
  const amplitudes = new Uint8Array(width);
  let inputPosition = 0;
  let outputPosition = 0;

  while (inputPosition < payload.length) {
    const token = payload[inputPosition++];
    if (token === undefined) throw new Error("Waveform envelope is truncated.");
    const length = (token & 0x7f) + 1;
    if (outputPosition + length > width) throw new Error("Waveform envelope is malformed.");

    if (token & 0x80) {
      const value = payload[inputPosition++];
      if (value === undefined) throw new Error("Waveform envelope is truncated.");
      amplitudes.fill(value, outputPosition, outputPosition + length);
    } else {
      if (inputPosition + length > payload.length) {
        throw new Error("Waveform envelope is truncated.");
      }
      amplitudes.set(payload.subarray(inputPosition, inputPosition + length), outputPosition);
      inputPosition += length;
    }
    outputPosition += length;
  }

  if (outputPosition !== width) throw new Error("Waveform envelope is incomplete.");
  return amplitudes;
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

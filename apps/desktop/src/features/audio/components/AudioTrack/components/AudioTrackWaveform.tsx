import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import { type AudioTrackState, waveformDisplayFailed } from "@/app/store/slices/audio-slice";
import { selectTrim } from "@/app/store/slices/trim-slice";
import { usePrimaryColor } from "@/app/theme/useTheme";
import { timelinePercent } from "@/domain/trim";
import { localizeAppError } from "@/i18n/app-errors";
import type { AudioStream } from "@/lib/tauri/media.types";

import { useAudioPlayback } from "../../../contexts/audio-playback-context";
import { useWaveformPrepare } from "../../../hooks/useWaveformPreparation";

interface AudioTrackWaveformProps {
  gainDb: number;
  magnifierEnabled: boolean;
  stream: AudioStream;
  track: AudioTrackState;
}

type WaveformWithStatus<Status extends AudioTrackState["waveform"]["status"]> = Extract<
  AudioTrackState["waveform"],
  { status: Status }
>;

function AudioTrackWaveform({ gainDb, magnifierEnabled, stream, track }: AudioTrackWaveformProps) {
  const trim = useAppSelector(selectTrim);
  const sourceDurationMicros = trim?.sourceDurationMicros ?? 1;
  const selectionStartPercent = trim ? timelinePercent(trim.startMicros, sourceDurationMicros) : 0;
  const selectionEndPercent = trim ? timelinePercent(trim.endMicros, sourceDurationMicros) : 100;

  switch (track.waveform.status) {
    case "idle":
    case "loading":
      return <AudioTrackWaveformLoading />;
    case "ready":
      return (
        <AudioTrackWaveformCanvas
          gainDb={gainDb}
          key={track.waveform.url}
          magnifierEnabled={magnifierEnabled}
          selectionEndPercent={selectionEndPercent}
          selectionStartPercent={selectionStartPercent}
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
const WAVEFORM_MAGNIFICATION = 12;
const ANIMATION_TIME_CONSTANT_MS = 90;
const ANIMATION_SETTLE_THRESHOLD = 0.01;

interface WaveformVisualState {
  color: [number, number, number];
  gainDb: number;
}

function AudioTrackWaveformCanvas({
  gainDb,
  magnifierEnabled,
  selectionEndPercent,
  selectionStartPercent,
  stream,
  waveform,
}: {
  gainDb: number;
  magnifierEnabled: boolean;
  selectionEndPercent: number;
  selectionStartPercent: number;
  stream: AudioStream;
  waveform: WaveformWithStatus<"ready">;
}) {
  const dispatch = useAppDispatch();
  const { audioPlayheadRef } = useAudioPlayback();
  const primaryColor = usePrimaryColor();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const magnifierCanvasRef = useRef<HTMLCanvasElement>(null);
  const envelopeRef = useRef<WaveformEnvelope | null>(null);
  const drawRef = useRef<() => void>(() => undefined);
  const drawMagnifierRef = useRef<() => void>(() => undefined);
  const frameRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number | null>(null);
  const targetRef = useRef<WaveformVisualState | null>(null);
  const visualRef = useRef<WaveformVisualState | null>(null);
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
    const visual = visualRef.current;
    if (!visual) return;

    const gain = 10 ** (visual.gainDb / 20);
    const centerY = pixelHeight / 2;
    context.strokeStyle = `rgb(${visual.color.map(Math.round).join(" ")})`;
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
  }, []);

  const drawMagnifier = useCallback(() => {
    const canvas = magnifierCanvasRef.current;
    const envelope = envelopeRef.current;
    const container = canvas?.parentElement;
    if (!canvas || !envelope || !container || !magnifierEnabled) return;

    const containerWidth = container.getBoundingClientRect().width;
    if (containerWidth <= 0) return;

    const pixelRatio = Math.max(window.devicePixelRatio || 1, 1);
    const cssWidth = Math.min(180, containerWidth);
    const pixelWidth = Math.max(1, Math.round(cssWidth * pixelRatio));
    const pixelHeight = Math.max(1, Math.round(canvas.getBoundingClientRect().height * pixelRatio));
    if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
    if (canvas.height !== pixelHeight) canvas.height = pixelHeight;

    const context = canvas.getContext("2d");
    if (!context) return;

    const playheadPercent = Math.min(
      1,
      Math.max(0, Number.parseFloat(audioPlayheadRef.current?.style.left ?? "0%") / 100),
    );

    const binsInView = Math.max(1, envelope.width / WAVEFORM_MAGNIFICATION);
    const centerBin = playheadPercent * envelope.width;
    const viewStart = Math.min(
      Math.max(0, centerBin - binsInView / 2),
      Math.max(0, envelope.width - binsInView),
    );

    const markerX = ((centerBin - viewStart) / binsInView) * pixelWidth;
    const containerPlayheadX = playheadPercent * containerWidth;
    canvas.style.left = `${Math.min(
      Math.max(0, containerPlayheadX - markerX / pixelRatio),
      Math.max(0, containerWidth - cssWidth),
    )}px`;

    context.clearRect(0, 0, pixelWidth, pixelHeight);
    context.fillStyle = "rgba(15, 15, 18, 0.94)";
    context.fillRect(0, 0, pixelWidth, pixelHeight);

    const visual = visualRef.current;
    const gain = 10 ** ((visual?.gainDb ?? gainDb) / 20);
    const centerY = pixelHeight / 2;
    context.strokeStyle = `rgb(${(visual?.color ?? parseHexColor(primaryColor)).map(Math.round).join(" ")})`;
    context.lineWidth = 1;
    context.beginPath();
    for (let x = 0; x < pixelWidth; x += 1) {
      const start = Math.floor(viewStart + (x * binsInView) / pixelWidth);
      const end = Math.max(start + 1, Math.ceil(viewStart + ((x + 1) * binsInView) / pixelWidth));
      let amplitude = 0;
      for (let bin = start; bin < Math.min(end, envelope.width); bin += 1) {
        amplitude = Math.max(amplitude, envelope.amplitudes[bin] ?? 0);
      }

      const halfHeight = Math.min(1, (amplitude / WAVEFORM_MAX_AMPLITUDE) * gain) * centerY;
      if (halfHeight > 0) {
        context.moveTo(x + 0.5, centerY - halfHeight);
        context.lineTo(x + 0.5, centerY + halfHeight);
      }
    }
    context.stroke();
    context.strokeStyle = "rgba(255, 255, 255, 0.9)";
    context.beginPath();
    context.moveTo(markerX + 0.5, 0);
    context.lineTo(markerX + 0.5, pixelHeight);
    context.stroke();
  }, [audioPlayheadRef, gainDb, magnifierEnabled, primaryColor]);

  const tickRef = useRef<(time: number) => void>(() => undefined);
  const tick = useCallback((time: number) => {
    frameRef.current = null;
    const current = visualRef.current;
    const next = targetRef.current;
    if (!current || !next) return;

    const previousTime = lastFrameTimeRef.current ?? time;
    const elapsed = Math.max(0, time - previousTime);
    lastFrameTimeRef.current = time;
    const progress = 1 - Math.exp(-elapsed / ANIMATION_TIME_CONSTANT_MS);
    current.gainDb += (next.gainDb - current.gainDb) * progress;
    current.color = current.color.map((channel, index) => {
      const targetChannel = next.color[index] ?? channel;
      return channel + (targetChannel - channel) * progress;
    }) as WaveformVisualState["color"];

    const settled =
      Math.abs(next.gainDb - current.gainDb) < ANIMATION_SETTLE_THRESHOLD &&
      current.color.every(
        (channel, index) => Math.abs(channel - (next.color[index] ?? channel)) < 1,
      );

    if (settled) {
      visualRef.current = { ...next, color: [...next.color] };
      lastFrameTimeRef.current = null;
    }
    drawRef.current();
    drawMagnifierRef.current();

    if (!settled) {
      frameRef.current = window.requestAnimationFrame((nextTime) => tickRef.current(nextTime));
    }
  }, []);

  const updateAnimation = useCallback(() => {
    if (!envelopeReady) return;
    if (!visualRef.current) {
      visualRef.current = { ...targetRef.current!, color: [...targetRef.current!.color] };
      drawRef.current();
      return;
    }
    if (frameRef.current === null) {
      lastFrameTimeRef.current = null;
      frameRef.current = window.requestAnimationFrame((time) => tickRef.current(time));
    }
  }, [envelopeReady]);

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
    drawMagnifierRef.current = drawMagnifier;
    targetRef.current = {
      color: parseHexColor(primaryColor),
      gainDb,
    };
    tickRef.current = tick;
    updateAnimation();
    drawMagnifier();
  }, [draw, drawMagnifier, envelopeReady, gainDb, primaryColor, tick, updateAnimation]);

  useEffect(
    () => () => {
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
      lastFrameTimeRef.current = null;
    },
    [],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handleResize = () => {
      drawRef.current();
      drawMagnifierRef.current();
    };

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

  useEffect(() => {
    const playhead = audioPlayheadRef.current;
    if (!magnifierEnabled || !playhead || typeof MutationObserver === "undefined") return;

    let frame: number | null = null;
    const observer = new MutationObserver(() => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(() => {
        frame = null;
        drawMagnifierRef.current();
      });
    });

    observer.observe(playhead, { attributeFilter: ["style"], attributes: true });
    drawMagnifierRef.current();

    return () => {
      observer.disconnect();
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, [audioPlayheadRef, magnifierEnabled]);

  return (
    <>
      <canvas
        aria-hidden="true"
        className="absolute inset-0 size-full"
        ref={canvasRef}
        style={{
          backgroundColor: "var(--muted)",
          backgroundImage:
            "linear-gradient(var(--muted), var(--muted)), repeating-linear-gradient(90deg, color-mix(in srgb, var(--foreground) 6%, transparent) 0 0.0625rem, transparent 0.0625rem 6.25%)",
          backgroundPosition: "left top, 0 0",
          backgroundRepeat: "no-repeat, repeat",
          backgroundSize: "0.0625rem 100%, auto",
        }}
      />
      {magnifierEnabled && (
        <canvas
          aria-hidden="true"
          className="pointer-events-none absolute top-0 z-2 h-full w-45 max-w-full rounded-md border border-primary/80 shadow-lg"
          data-slot="audio-waveform-magnifier"
          ref={magnifierCanvasRef}
        />
      )}
      {selectionStartPercent > 0 && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 bg-background/40"
          data-edge="start"
          data-slot="audio-waveform-outside-selection"
          style={{ left: "0%", width: `${selectionStartPercent}%` }}
        />
      )}
      {selectionEndPercent < 100 && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 bg-background/40"
          data-edge="end"
          data-slot="audio-waveform-outside-selection"
          style={{ left: `${selectionEndPercent}%`, right: "0%" }}
        />
      )}
    </>
  );
}

function parseHexColor(color: string): [number, number, number] {
  return [
    Number.parseInt(color.slice(1, 3), 16),
    Number.parseInt(color.slice(3, 5), 16),
    Number.parseInt(color.slice(5, 7), 16),
  ];
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

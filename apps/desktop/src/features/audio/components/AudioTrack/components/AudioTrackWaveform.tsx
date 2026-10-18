import { useReducedMotion } from "motion/react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import { type AudioTrackState, waveformDisplayFailed } from "@/app/store/slices/audio-slice";
import { selectSourceLoadToken } from "@/app/store/slices/source-slice";
import { usePrimaryColor } from "@/app/theme/useTheme";
import { type AudioSyncOffset, effectiveAudioOffsetMicros } from "@/domain/audio-processing";
import { cn } from "@/lib/class-names.utils";
import type { AudioStream } from "@/lib/tauri/media.types";

import type { WaveformDisplayMode } from "../../../lib/waveform-display-mode";

import { AudioTrackWaveformStatus } from "./AudioTrackWaveformStatus";

interface AudioTrackWaveformProps {
  displayMode: WaveformDisplayMode;
  stream: AudioStream;
  syncOffset?: AudioSyncOffset | null;
  timelineDurationMicros?: number;
  track: AudioTrackState;
  volume: number;
}

function AudioTrackWaveform({
  displayMode,
  stream,
  syncOffset,
  timelineDurationMicros = stream.durationMicros ?? 0,
  track,
  volume,
}: AudioTrackWaveformProps) {
  const loadToken = useAppSelector(selectSourceLoadToken);
  return (
    <AudioTrackWaveformCanvas
      displayMode={displayMode}
      key={`${loadToken}:${stream.streamIndex}`}
      stream={stream}
      syncOffsetMicros={effectiveAudioOffsetMicros(
        syncOffset === undefined ? track.processing.syncOffset : (syncOffset ?? undefined),
      )}
      timelineDurationMicros={timelineDurationMicros}
      volume={volume}
      waveform={track.waveform}
    />
  );
}

interface WaveformEnvelope {
  values: Uint8Array;
  width: number;
}

const WAVEFORM_HEADER_SIZE = 12;
const WAVEFORM_FORMAT_VERSION = 2;
const WAVEFORM_FLAG_RLE = 1;
const WAVEFORM_MAX_AMPLITUDE = 255;
const ANIMATION_TIME_CONSTANT_MS = 90;

const WAVEFORM_CROSSFADE_MS = 250;
const MIN_DISPLAY_VOLUME = 1e-4;

interface WaveformVisualState {
  color: [number, number, number];
  gainDb: number;
  waveformStartPercent: number;
}

function AudioTrackWaveformCanvas({
  displayMode,
  stream,
  syncOffsetMicros,
  timelineDurationMicros,
  volume,
  waveform,
}: {
  displayMode: WaveformDisplayMode;
  stream: AudioStream;
  syncOffsetMicros: number;
  timelineDurationMicros: number;
  volume: number;
  waveform: AudioTrackState["waveform"];
}) {
  const dispatch = useAppDispatch();
  const primaryColor = usePrimaryColor();
  const reducedMotion = useReducedMotion() === true;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Decoded envelopes and animation resources belong to this source/stream's mounted canvas.
  const envelopeRef = useRef<WaveformEnvelope | null>(null);
  const transitionRef = useRef<{
    from: HTMLCanvasElement;
    progress: number;
    startedAt: number | null;
  } | null>(null);

  const frameRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number | null>(null);
  const targetRef = useRef<WaveformVisualState | null>(null);
  const visualRef = useRef<WaveformVisualState | null>(null);
  const currentRequestRef = useRef(waveform);
  const reducedMotionRef = useRef(reducedMotion);
  const [loaded, setLoaded] = useState<{ jobId: string; url: string } | null>(null);
  const drawRef = useRef<() => void>(() => undefined);
  const tickRef = useRef<(time: number) => void>(() => undefined);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const envelope = envelopeRef.current;
    const visual = visualRef.current;
    if (!canvas || !envelope || !visual) return;
    const bounds = canvas.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const width = Math.max(1, Math.round(bounds.width * ratio));
    const height = Math.max(1, Math.round(bounds.height * ratio));
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, width, height);
    const transition = transitionRef.current;
    if (transition) {
      context.globalAlpha = 1 - transition.progress;
      context.drawImage(transition.from, 0, 0, width, height);
    }
    context.globalAlpha = transition?.progress ?? 1;
    context.globalCompositeOperation = transition ? "lighter" : "source-over";
    drawEnvelope(context, envelope, displayMode, visual, width, height);
    context.globalAlpha = 1;
    context.globalCompositeOperation = "source-over";
  }, [displayMode]);

  const tick = useCallback((time: number) => {
    frameRef.current = null;
    const current = visualRef.current;
    const next = targetRef.current;
    if (!current || !next) return;
    const elapsed = Math.max(0, time - (lastFrameTimeRef.current ?? time));
    lastFrameTimeRef.current = time;
    const progress = reducedMotionRef.current
      ? 1
      : 1 - Math.exp(-elapsed / ANIMATION_TIME_CONSTANT_MS);

    current.gainDb += (next.gainDb - current.gainDb) * progress;
    current.waveformStartPercent +=
      (next.waveformStartPercent - current.waveformStartPercent) * progress;
    current.color = current.color.map(
      (channel, index) => channel + ((next.color[index] ?? channel) - channel) * progress,
    ) as WaveformVisualState["color"];
    const settled =
      Math.abs(next.gainDb - current.gainDb) < 0.01 &&
      Math.abs(next.waveformStartPercent - current.waveformStartPercent) < 0.001 &&
      current.color.every(
        (channel, index) => Math.abs(channel - (next.color[index] ?? channel)) < 1,
      );

    if (settled) visualRef.current = { ...next, color: [...next.color] };
    const transition = transitionRef.current;
    if (transition) {
      transition.startedAt ??= time;
      transition.progress = reducedMotionRef.current
        ? 1
        : Math.min(1, (time - transition.startedAt) / WAVEFORM_CROSSFADE_MS);
      if (transition.progress === 1) transitionRef.current = null;
    }
    drawRef.current();
    if (!settled || transitionRef.current) {
      frameRef.current = window.requestAnimationFrame((nextTime) => tickRef.current(nextTime));
    } else {
      lastFrameTimeRef.current = null;
    }
  }, []);

  const updateAnimation = useCallback(() => {
    if (!envelopeRef.current || !targetRef.current) return;
    if (!visualRef.current || reducedMotionRef.current) {
      visualRef.current = { ...targetRef.current, color: [...targetRef.current.color] };
      if (reducedMotionRef.current) transitionRef.current = null;
      drawRef.current();
      if (reducedMotionRef.current) {
        if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
        lastFrameTimeRef.current = null;
        return;
      }
    }
    if (frameRef.current === null) {
      lastFrameTimeRef.current = null;
      frameRef.current = window.requestAnimationFrame((time) => tickRef.current(time));
    }
  }, []);

  useLayoutEffect(() => {
    currentRequestRef.current = waveform;
    reducedMotionRef.current = reducedMotion;
    drawRef.current = draw;
    tickRef.current = tick;
    targetRef.current = {
      color: parseHexColor(primaryColor),
      gainDb: 20 * Math.log10(Math.max(volume, MIN_DISPLAY_VOLUME)),
      waveformStartPercent:
        timelineDurationMicros > 0 ? (syncOffsetMicros / timelineDurationMicros) * 100 : 0,
    };
    updateAnimation();
  }, [
    draw,
    primaryColor,
    reducedMotion,
    syncOffsetMicros,
    tick,
    timelineDurationMicros,
    updateAnimation,
    volume,
    waveform,
  ]);

  useEffect(() => {
    if (waveform.status !== "ready") return;
    let active = true;
    const controller = new AbortController();
    const isCurrent = () => {
      const current = currentRequestRef.current;
      return (
        active &&
        current.status === "ready" &&
        current.jobId === waveform.jobId &&
        current.url === waveform.url
      );
    };

    void fetch(waveform.url, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Waveform envelope request failed.");
        return response.arrayBuffer();
      })
      .then((buffer) => {
        if (!isCurrent()) return;
        const envelope = parseWaveformEnvelope(buffer, waveform.width);
        const canvas = canvasRef.current;
        if (
          envelopeRef.current &&
          canvas &&
          canvas.width > 0 &&
          canvas.height > 0 &&
          !reducedMotionRef.current
        ) {
          // Rebase an interrupted fade on the exact visible composite. Only one snapshot and
          // one target envelope are retained, even during rapid consecutive replacements.
          const snapshot = document.createElement("canvas");
          snapshot.width = canvas.width;
          snapshot.height = canvas.height;
          const context = snapshot.getContext("2d");
          if (context) {
            context.drawImage(canvas, 0, 0);
            transitionRef.current = { from: snapshot, startedAt: null, progress: 0 };
          }
        } else {
          transitionRef.current = null;
        }
        envelopeRef.current = envelope;
        setLoaded({ jobId: waveform.jobId, url: waveform.url });
        updateAnimation();
      })
      .catch(() => {
        if (isCurrent())
          dispatch(
            waveformDisplayFailed({
              streamIndex: stream.streamIndex,
              jobId: waveform.jobId,
              url: waveform.url,
            }),
          );
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [dispatch, stream.streamIndex, updateAnimation, waveform]);

  useEffect(
    () => () => {
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
      transitionRef.current = null;
      envelopeRef.current = null;
    },
    [],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handleResize = () => drawRef.current();
    window.addEventListener("resize", handleResize);
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(handleResize);

    observer?.observe(canvas);
    return () => {
      window.removeEventListener("resize", handleResize);
      observer?.disconnect();
    };
  }, []);

  const loading =
    waveform.status === "idle" ||
    waveform.status === "loading" ||
    (waveform.status === "ready" &&
      (loaded?.jobId !== waveform.jobId || loaded.url !== waveform.url));

  const hasEnvelope = loaded !== null;
  // After a failed regeneration the drawn envelope belongs to earlier processing. It stays as a
  // fallback but must not look like the waveform of the processing that was just applied.
  const outdated = hasEnvelope && waveform.status === "failed";

  return (
    <>
      <canvas
        aria-hidden="true"
        className={cn(
          "size-full opacity-80 transition-[opacity,filter] duration-200 motion-reduce:transition-none",
          outdated && "opacity-25 grayscale",
        )}
        data-outdated={outdated}
        ref={canvasRef}
      />
      <AudioTrackWaveformStatus
        hasEnvelope={hasEnvelope}
        loading={loading}
        reducedMotion={reducedMotion}
        streamIndex={stream.streamIndex}
        waveform={waveform}
      />
    </>
  );
}

function drawEnvelope(
  context: CanvasRenderingContext2D,
  envelope: WaveformEnvelope,
  displayMode: WaveformDisplayMode,
  visual: WaveformVisualState,
  width: number,
  height: number,
) {
  const gain = 10 ** (visual.gainDb / 20);
  const shiftPixels = (visual.waveformStartPercent / 100) * width;
  context.strokeStyle = `rgb(${visual.color.map(Math.round).join(" ")})`;
  context.lineWidth = 1;
  context.beginPath();
  for (let x = 0; x < width; x += 1) {
    const sourceX = x - shiftPixels;
    if (sourceX < 0 || sourceX >= width) continue;
    const start = Math.floor((sourceX * envelope.width) / width);
    const end = Math.max(start + 1, Math.ceil(((sourceX + 1) * envelope.width) / width));
    let peakLeft = 0;
    let peakRight = 0;
    let rmsLeft = 0;
    let rmsRight = 0;
    for (let bin = start; bin < Math.min(end, envelope.width); bin += 1) {
      const offset = bin * 4;
      peakLeft = Math.max(peakLeft, envelope.values[offset] ?? 0);
      peakRight = Math.max(peakRight, envelope.values[offset + 2] ?? 0);
      rmsLeft = Math.max(rmsLeft, envelope.values[offset + 1] ?? 0);
      rmsRight = Math.max(rmsRight, envelope.values[offset + 3] ?? 0);
    }
    if (displayMode === "stereo") {
      drawChannel(x, height * 0.25, height * 0.25, peakLeft * gain, context);
      drawChannel(x, height * 0.75, height * 0.25, peakRight * gain, context);
    } else {
      const amplitude =
        displayMode === "peak"
          ? Math.max(peakLeft, peakRight)
          : Math.sqrt((rmsLeft ** 2 + rmsRight ** 2) / 2);

      drawChannel(x, height / 2, height / 2, amplitude * gain, context);
    }
  }
  context.stroke();
}

function drawChannel(
  x: number,
  centerY: number,
  maxHalfHeight: number,
  amplitude: number,
  context: CanvasRenderingContext2D,
) {
  const halfHeight = Math.min(1, amplitude / WAVEFORM_MAX_AMPLITUDE) * maxHalfHeight;
  if (halfHeight > 0) {
    context.moveTo(x + 0.5, centerY - halfHeight);
    context.lineTo(x + 0.5, centerY + halfHeight);
  }
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
  const values = flags & WAVEFORM_FLAG_RLE ? decodeRle(payload, width * 4) : payload;
  if (values.length !== width * 4) throw new Error("Waveform envelope size is invalid.");
  return { values, width };
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

export { AudioTrackWaveform };

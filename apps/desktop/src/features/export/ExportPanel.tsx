import { useMemo, useState } from "react";

import type { TrimRange } from "../../domain/trim";
import {
  cancelOperation,
  chooseOutputPath,
  normalizeAppError,
  renderFast,
  renderOptimized,
  type ExportProgress,
  type FastExportRequest,
  type FrameRate,
  type MediaInfo,
  type OptimizedExportRequest,
} from "../../lib/tauri/media";
import type { AudioTrackState } from "../../app/session-state";

const DEFAULT_ARGUMENTS =
  "-c:v hevc_nvenc -preset p5 -tune hq -rc vbr -cq 24 -b:v 0 -spatial_aq 1 -temporal_aq 1 -aq-strength 8 -pix_fmt yuv420p -c:a aac -b:a 160k";

interface ExportPanelProps {
  source: MediaInfo;
  sourceName: string;
  trim: TrimRange;
  audioTracks: AudioTrackState[];
  mergeAudio: boolean;
}

export function ExportPanel({
  source,
  sourceName,
  trim,
  audioTracks,
  mergeAudio,
}: ExportPanelProps) {
  const sourceRate = source.video.averageFrameRate ?? source.video.realFrameRate;
  const defaults = useMemo(() => outputDefaults(sourceName), [sourceName]);
  const [outputName, setOutputName] = useState(defaults.fast);
  const [resolution, setResolution] = useState({
    width: source.video.width,
    height: source.video.height,
  });
  const [frameRate, setFrameRate] = useState<FrameRate | undefined>(sourceRate);
  const [argumentsText, setArgumentsText] = useState(DEFAULT_ARGUMENTS);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [operationId, setOperationId] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedAudio = audioTracks
    .filter((track) => track.enabled)
    .map((track) => track.streamIndex);
  const rendering = isStarting || operationId !== null;

  async function startFast() {
    const request: FastExportRequest = {
      sourceId: source.sourceId,
      trim: { startMicros: trim.startMicros, endMicros: trim.endMicros },
      audioStreamIndexes: selectedAudio,
      mergeAudio,
    };
    await startRender("fast", defaults.fast, request);
  }

  async function startOptimized() {
    const request: OptimizedExportRequest = {
      sourceId: source.sourceId,
      trim: { startMicros: trim.startMicros, endMicros: trim.endMicros },
      audioStreamIndexes: selectedAudio,
      mergeAudio,
      resolution,
      frameRate: frameRate
        ? { numerator: frameRate.numerator, denominator: frameRate.denominator }
        : undefined,
      arguments: argumentsText,
    };
    await startRender("optimized", defaults.optimized, request);
  }

  async function startRender(
    route: "fast" | "optimized",
    fallbackName: string,
    request: FastExportRequest | OptimizedExportRequest,
  ) {
    if (rendering || outputName.trim().length === 0) {
      setError("Enter an output name before exporting.");
      return;
    }
    setError(null);
    setStatus(null);
    setIsStarting(true);
    try {
      const requestedName =
        outputName === defaults.fast && route === "optimized"
          ? defaults.optimized
          : outputName.trim() || fallbackName;
      const output = await chooseOutputPath(requestedName);
      if (!output) return;
      setOutputName(output.displayName);
      const onProgress = (next: ExportProgress) => {
        setProgress(next);
        setOperationId(next.operationId);
      };
      const result =
        route === "fast"
          ? await renderFast(request, output.outputId, onProgress)
          : await renderOptimized(request as OptimizedExportRequest, output.outputId, onProgress);
      setOperationId(null);
      setStatus(`Saved ${result.displayName}`);
      setProgress({
        operationId: result.operationId,
        percentage: 100,
        elapsedMicros: trim.endMicros - trim.startMicros,
        phase: "completed",
      });
    } catch (nextError: unknown) {
      setOperationId(null);
      setError(normalizeAppError(nextError).message);
    } finally {
      setIsStarting(false);
    }
  }

  async function handleCancel() {
    if (!operationId) return;
    try {
      await cancelOperation(operationId);
      setStatus("Cancelling export…");
    } catch (nextError: unknown) {
      setError(normalizeAppError(nextError).message);
    }
  }

  return (
    <section className="export-panel" aria-labelledby="export-title">
      <div className="section-heading-row">
        <div>
          <p className="section-label">Export</p>
          <h2 id="export-title">Save selected segment</h2>
        </div>
        {progress ? (
          <span className="export-progress-label" role="status">
            {Math.round(progress.percentage)}%{progress.speed ? ` · ${progress.speed}` : ""}
          </span>
        ) : null}
      </div>

      <label className="export-field">
        <span>Output name</span>
        <input
          value={outputName}
          onChange={(event) => setOutputName(event.target.value)}
          required
        />
      </label>

      <div className="export-route-grid">
        <button
          className="primary-button"
          type="button"
          onClick={() => void startFast()}
          disabled={rendering}
        >
          Fast cut
          <small>Copy video · source size/FPS</small>
        </button>
        <button
          className="primary-button"
          type="button"
          onClick={() => void startOptimized()}
          disabled={rendering}
        >
          Optimized render
          <small>Scale, FPS, and codec settings</small>
        </button>
      </div>

      <div className="optimized-options">
        <label className="export-field">
          <span>Resolution</span>
          <select
            value={`${resolution.width}x${resolution.height}`}
            onChange={(event) => {
              const [width, height] = event.target.value.split("x").map(Number);
              if (width && height) {
                setResolution({ width, height });
              }
            }}
          >
            {resolutionOptions(source).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="export-field">
          <span>Frame rate</span>
          <select
            value={frameRate ? `${frameRate.numerator}/${frameRate.denominator}` : "source"}
            onChange={(event) => setFrameRate(rateFromValue(event.target.value, sourceRate))}
          >
            <option value="source">Source FPS</option>
            {[24, 25, 30, 50, 60, 120].map((rate) => (
              <option key={rate} value={`${rate}/1`}>
                {rate} FPS
              </option>
            ))}
          </select>
        </label>
        <label className="export-field export-arguments">
          <span>FFmpeg arguments</span>
          <textarea
            value={argumentsText}
            onChange={(event) => setArgumentsText(event.target.value)}
            rows={2}
          />
        </label>
      </div>

      {rendering ? (
        <div className="export-running">
          <progress max={100} value={progress?.percentage ?? 0} />
          <button className="secondary-button" type="button" onClick={() => void handleCancel()}>
            Cancel
          </button>
        </div>
      ) : null}
      {status ? <p className="export-status">{status}</p> : null}
      {error ? (
        <p className="inline-alert" role="alert">
          {error}
        </p>
      ) : null}
      <p className="export-note">
        Only the selected segment and enabled audio tracks will be exported.
      </p>
    </section>
  );
}

function outputDefaults(sourceName: string) {
  const stem = sourceName.replace(/\.[^/.]+$/, "") || "clip";
  return { fast: `${stem}-cut.mkv`, optimized: `${stem}-optimized.mp4` };
}

function resolutionOptions(source: MediaInfo) {
  const options = [
    {
      label: `Source · ${source.video.width} × ${source.video.height}`,
      value: `${source.video.width}x${source.video.height}`,
    },
  ];
  for (const height of [2160, 1440, 1080]) {
    if (height < source.video.height) {
      const width = Math.round((source.video.width * height) / source.video.height / 2) * 2;
      options.push({ label: `${height}p · ${width} × ${height}`, value: `${width}x${height}` });
    }
  }
  return options;
}

function rateFromValue(value: string, sourceRate: FrameRate | undefined): FrameRate | undefined {
  if (value === "source") return sourceRate;
  const [numerator, denominator] = value.split("/").map(Number);
  return numerator && denominator ? { numerator, denominator } : sourceRate;
}

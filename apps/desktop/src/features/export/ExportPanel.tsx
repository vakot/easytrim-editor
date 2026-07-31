import { useMemo, useState } from "react";

import type { AudioTrackState } from "../../app/session-state";
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
  const [isOptimizedOpen, setIsOptimizedOpen] = useState(false);
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
  const isBusy = isStarting || operationId !== null;

  async function handleFastCut() {
    const request: FastExportRequest = {
      sourceId: source.sourceId,
      trim: { startMicros: trim.startMicros, endMicros: trim.endMicros },
      audioStreamIndexes: selectedAudio,
      mergeAudio,
    };
    await runExport("fast", defaults.fast, request);
  }

  async function handleOptimizedRender() {
    setIsOptimizedOpen(false);
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
    await runExport("optimized", defaults.optimized, request);
  }

  async function runExport(
    route: "fast" | "optimized",
    defaultName: string,
    request: FastExportRequest | OptimizedExportRequest,
  ) {
    if (isBusy) return;
    setError(null);
    setStatus(null);
    setProgress(null);
    setIsStarting(true);
    try {
      const output = await chooseOutputPath(defaultName);
      if (!output) return;

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
    <div className="export-toolbar-group">
      <div className="toolbar-divider" aria-hidden="true" />
      <button
        className="toolbar-button export-button"
        type="button"
        onClick={() => void handleFastCut()}
        disabled={isBusy}
      >
        Fast cut
      </button>
      <div className="export-config-anchor">
        <button
          className="toolbar-button export-button"
          type="button"
          onClick={() => {
            setError(null);
            setIsOptimizedOpen((open) => !open);
          }}
          disabled={isBusy}
          aria-haspopup="dialog"
          aria-expanded={isOptimizedOpen}
        >
          Optimized render
        </button>
        {isOptimizedOpen ? (
          <div className="export-dialog" role="dialog" aria-labelledby="optimized-export-title">
            <div className="export-dialog-header">
              <div>
                <p className="section-label">Export</p>
                <h2 id="optimized-export-title">Optimized render</h2>
              </div>
              <button
                className="icon-button"
                type="button"
                onClick={() => setIsOptimizedOpen(false)}
                aria-label="Close optimized render settings"
              >
                ×
              </button>
            </div>
            <div className="optimized-options">
              <label className="export-field">
                <span>Resolution</span>
                <select
                  value={`${resolution.width}x${resolution.height}`}
                  onChange={(event) => {
                    const [width, height] = event.target.value.split("x").map(Number);
                    if (width && height) setResolution({ width, height });
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
            </div>
            <label className="export-field export-arguments">
              <span>FFmpeg arguments</span>
              <textarea
                value={argumentsText}
                onChange={(event) => setArgumentsText(event.target.value)}
                rows={4}
              />
            </label>
            <p className="export-note">The native save dialog opens after confirmation.</p>
            <div className="export-dialog-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => setIsOptimizedOpen(false)}
              >
                Cancel
              </button>
              <button
                className="primary-button"
                type="button"
                onClick={() => void handleOptimizedRender()}
              >
                Choose output path
              </button>
            </div>
          </div>
        ) : null}
      </div>
      {progress ? (
        <span className="export-progress-label" role="status">
          {Math.round(progress.percentage)}%
        </span>
      ) : null}
      {isBusy ? (
        <button
          className="toolbar-button export-cancel-button"
          type="button"
          onClick={() => void handleCancel()}
        >
          Cancel
        </button>
      ) : null}
      {status ? <span className="export-status">{status}</span> : null}
      {error ? (
        <span className="export-error" role="alert">
          {error}
        </span>
      ) : null}
    </div>
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

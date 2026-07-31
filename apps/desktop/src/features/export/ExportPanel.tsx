import { useMemo, useRef, useState } from "react";

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
  type OutputSelection,
} from "../../lib/tauri/media";

const DEFAULT_ARGUMENTS =
  "-c:v hevc_nvenc -preset p5 -tune hq -rc vbr -cq 24 -b:v 0 -spatial_aq 1 -temporal_aq 1 -aq-strength 8 -pix_fmt yuv420p -c:a aac -b:a 160k";
const TOAST_REMOVE_DELAY_MS = 3_500;

type ToastStatus = "rendering" | "completed" | "failed";

interface ExportToast {
  id: string;
  operationId: string | null;
  filename: string;
  path: string;
  percentage: number;
  status: ToastStatus;
  error?: string;
}

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
  const defaults = useMemo(() => outputDefaults(sourceName), [sourceName]);
  const [isOptimizedOpen, setIsOptimizedOpen] = useState(false);
  const [resolution, setResolution] = useState({
    width: source.video.width,
    height: source.video.height,
  });
  const [frameRate, setFrameRate] = useState<FrameRate | undefined>();
  const [argumentsText, setArgumentsText] = useState(DEFAULT_ARGUMENTS);
  const [queue, setQueue] = useState<ExportToast[]>([]);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const canceledRef = useRef(new Set<string>());
  const toastSequence = useRef(0);

  const selectedAudio = audioTracks
    .filter((track) => track.enabled)
    .map((track) => track.streamIndex);

  async function handleFastCut() {
    const request: FastExportRequest = {
      sourceId: source.sourceId,
      trim: { startMicros: trim.startMicros, endMicros: trim.endMicros },
      audioStreamIndexes: selectedAudio,
      mergeAudio,
    };
    await chooseAndStart("fast", defaults.fast, request);
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
    await chooseAndStart("optimized", defaults.optimized, request);
  }

  async function chooseAndStart(
    route: "fast" | "optimized",
    defaultName: string,
    request: FastExportRequest | OptimizedExportRequest,
  ) {
    setLaunchError(null);
    try {
      const output = await chooseOutputPath(defaultName);
      if (output) {
        startQueuedExport(route, request, output);
      }
    } catch (nextError: unknown) {
      setLaunchError(normalizeAppError(nextError).message);
    }
  }

  function startQueuedExport(
    route: "fast" | "optimized",
    request: FastExportRequest | OptimizedExportRequest,
    output: OutputSelection,
  ) {
    const id = `export-toast-${++toastSequence.current}`;
    setQueue((current) => [
      ...current,
      {
        id,
        operationId: null,
        filename: output.displayName,
        path: output.displayPath,
        percentage: 0,
        status: "rendering",
      },
    ]);
    void renderQueuedExport(id, route, request, output);
  }

  async function renderQueuedExport(
    id: string,
    route: "fast" | "optimized",
    request: FastExportRequest | OptimizedExportRequest,
    output: OutputSelection,
  ) {
    const onProgress = (next: ExportProgress) => {
      if (canceledRef.current.has(id)) {
        void cancelOperation(next.operationId).catch(() => undefined);
        return;
      }
      updateToast(id, (toast) => ({
        ...toast,
        operationId: next.operationId,
        percentage: Math.round(next.percentage),
      }));
    };

    try {
      const result =
        route === "fast"
          ? await renderFast(request, output.outputId, onProgress)
          : await renderOptimized(request as OptimizedExportRequest, output.outputId, onProgress);
      if (canceledRef.current.has(id)) return;
      updateToast(id, (toast) => ({
        ...toast,
        operationId: result.operationId,
        path: result.displayPath,
        percentage: 100,
        status: "completed",
      }));
      removeToastLater(id);
    } catch (nextError: unknown) {
      if (canceledRef.current.has(id)) return;
      updateToast(id, (toast) => ({
        ...toast,
        status: "failed",
        error: normalizeAppError(nextError).message,
      }));
      removeToastLater(id);
    }
  }

  function updateToast(id: string, update: (toast: ExportToast) => ExportToast) {
    setQueue((current) => current.map((toast) => (toast.id === id ? update(toast) : toast)));
  }

  function removeToastLater(id: string) {
    window.setTimeout(() => {
      setQueue((current) => current.filter((toast) => toast.id !== id));
    }, TOAST_REMOVE_DELAY_MS);
  }

  function handleCancel(toast: ExportToast) {
    canceledRef.current.add(toast.id);
    setQueue((current) => current.filter((item) => item.id !== toast.id));
    if (toast.operationId) {
      void cancelOperation(toast.operationId).catch(() => undefined);
    }
  }

  return (
    <>
      <div className="export-toolbar-group">
        <div className="toolbar-divider" aria-hidden="true" />
        <button
          className="toolbar-button export-button"
          type="button"
          onClick={() => void handleFastCut()}
        >
          Fast cut
        </button>
        <div className="export-config-anchor">
          <button
            className="toolbar-button export-button"
            type="button"
            onClick={() => {
              setLaunchError(null);
              setIsOptimizedOpen((open) => !open);
            }}
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
                    onChange={(event) => setFrameRate(rateFromValue(event.target.value))}
                  >
                    <option value="source">Match source</option>
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
        {launchError ? (
          <span className="export-error" role="alert">
            {launchError}
          </span>
        ) : null}
      </div>
      {queue.length > 0 ? (
        <div className="export-queue" role="status" aria-live="polite">
          {queue.map((toast) => (
            <div className={`export-toast export-toast-${toast.status}`} key={toast.id}>
              <div className="export-toast-copy">
                <div className="export-toast-title">
                  <strong>{toast.filename}</strong>
                  <span>· {toast.percentage}%</span>
                </div>
                <span className="export-toast-path" title={toast.path}>
                  {toast.path}
                </span>
                {toast.error ? <span className="export-toast-error">{toast.error}</span> : null}
              </div>
              <div className="export-toast-actions">
                {toast.status === "rendering" ? (
                  <button
                    type="button"
                    onClick={() => handleCancel(toast)}
                    aria-label={`Cancel ${toast.filename}`}
                  >
                    Cancel
                  </button>
                ) : (
                  <span
                    aria-label={toast.status === "completed" ? "Export complete" : "Export failed"}
                  >
                    {toast.status === "completed" ? "✓" : "!"}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </>
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

function rateFromValue(value: string): FrameRate | undefined {
  if (value === "source") return undefined;
  const [numerator, denominator] = value.split("/").map(Number);
  return numerator && denominator ? { numerator, denominator } : undefined;
}

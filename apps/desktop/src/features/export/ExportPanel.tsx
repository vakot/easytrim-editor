import type { Dispatch, SetStateAction } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import type { AudioTrackState } from "../../app/session-state";
import type { TrimRange } from "../../domain/trim";
import {
  cancelOperation,
  chooseOutputPath,
  normalizeAppError,
  planOptimizedExport,
  renderFast,
  renderOptimized,
  revealInExplorer,
  type ExportProgress,
  type FastExportRequest,
  type FrameRate,
  type MediaInfo,
  type OptimizedExportRequest,
  type OutputSelection,
} from "../../lib/tauri/media";
import {
  presetNameError,
  selectedExportPreset,
  type ExportPresetAction,
  type ExportPresetState,
} from "./export-presets";

type ToastStatus = "rendering" | "completed" | "failed" | "canceled";
type ExportPlanState =
  | { status: "idle" }
  | { status: "loading"; requestKey: string }
  | { status: "ready"; requestKey: string; commandPreview: string }
  | { status: "failed"; requestKey: string; message: string };

const FRAME_RATE_OPTIONS = [
  { label: "23.976 FPS", numerator: 24_000, denominator: 1_001 },
  { label: "24 FPS", numerator: 24, denominator: 1 },
  { label: "25 FPS", numerator: 25, denominator: 1 },
  { label: "29.97 FPS", numerator: 30_000, denominator: 1_001 },
  { label: "30 FPS", numerator: 30, denominator: 1 },
  { label: "50 FPS", numerator: 50, denominator: 1 },
  { label: "59.94 FPS", numerator: 60_000, denominator: 1_001 },
  { label: "60 FPS", numerator: 60, denominator: 1 },
  { label: "120 FPS", numerator: 120, denominator: 1 },
] as const;

export interface ExportToast {
  id: string;
  operationId: string | null;
  filename: string;
  path: string;
  percentage: number;
  status: ToastStatus;
  error?: string;
  onCancel?: () => void;
}

interface ExportPanelProps {
  source: MediaInfo;
  sourceName: string;
  trim: TrimRange;
  audioTracks: AudioTrackState[];
  masterEnabled: boolean;
  masterVolumePercent: number;
  mergeAudio: boolean;
  queue: ExportToast[];
  setQueue: Dispatch<SetStateAction<ExportToast[]>>;
  presetState: ExportPresetState;
  onPresetAction: Dispatch<ExportPresetAction>;
  onNativeDialogStateChange: (open: boolean) => void;
}

export function ExportPanel({
  source,
  sourceName,
  trim,
  audioTracks,
  masterEnabled,
  masterVolumePercent,
  mergeAudio,
  setQueue,
  presetState,
  onPresetAction,
  onNativeDialogStateChange,
}: ExportPanelProps) {
  const defaults = useMemo(() => outputDefaults(sourceName), [sourceName]);
  const sourceResolution = useMemo(() => displayResolution(source), [source]);
  const [isOptimizedOpen, setIsOptimizedOpen] = useState(false);
  const [resolution, setResolution] = useState(sourceResolution);
  const [frameRate, setFrameRate] = useState<FrameRate | undefined>();
  const [presetNameDraft, setPresetNameDraft] = useState(() => ({
    presetId: presetState.selectedPresetId,
    value: selectedExportPreset(presetState)?.name ?? "",
  }));
  const [presetError, setPresetError] = useState<string | null>(null);
  const [exportPlan, setExportPlan] = useState<ExportPlanState>({ status: "idle" });
  const [launchError, setLaunchError] = useState<string | null>(null);
  const canceledRef = useRef(new Set<string>());
  const operationIdsRef = useRef(new Map<string, string>());
  const toastSequence = useRef(0);
  const presetName =
    presetNameDraft.presetId === presetState.selectedPresetId
      ? presetNameDraft.value
      : (selectedExportPreset(presetState)?.name ?? "");

  useEffect(() => {
    function handleExportShortcut(event: KeyboardEvent) {
      if (!event.ctrlKey || event.altKey || event.metaKey || isEditableTarget(event.target)) {
        return;
      }
      if (event.key.toLowerCase() === "s") {
        event.preventDefault();
        void handleFastCut();
      } else if (event.key.toLowerCase() === "e") {
        event.preventDefault();
        openOptimizedSettings();
      }
    }

    window.addEventListener("keydown", handleExportShortcut, true);
    return () => window.removeEventListener("keydown", handleExportShortcut, true);
  });

  const selectedAudio = useMemo(() => {
    const masterGain = masterEnabled ? masterVolumePercent / 50 : 0;
    return audioTracks
      .filter((track) => track.enabled && track.volumePercent > 0 && masterGain > 0)
      .map((track) => ({
        streamIndex: track.streamIndex,
        volumePercent: Math.min(200, Math.round(track.volumePercent * masterGain)),
      }))
      .filter((track) => track.volumePercent > 0);
  }, [audioTracks, masterEnabled, masterVolumePercent]);

  const optimizedRequest = useMemo<OptimizedExportRequest>(
    () => ({
      sourceId: source.sourceId,
      trim: { startMicros: trim.startMicros, endMicros: trim.endMicros },
      audioTracks: selectedAudio,
      mergeAudio,
      resolution,
      frameRate: frameRate
        ? { numerator: frameRate.numerator, denominator: frameRate.denominator }
        : undefined,
      arguments: presetState.argumentsText,
    }),
    [frameRate, mergeAudio, presetState.argumentsText, resolution, selectedAudio, source, trim],
  );
  const optimizedRequestKey = JSON.stringify(optimizedRequest);
  const currentExportPlan =
    exportPlan.status !== "idle" && exportPlan.requestKey === optimizedRequestKey
      ? exportPlan
      : ({ status: "loading", requestKey: optimizedRequestKey } satisfies ExportPlanState);

  useEffect(() => {
    if (!isOptimizedOpen) {
      return;
    }
    let disposed = false;
    const timeout = window.setTimeout(() => {
      void planOptimizedExport(optimizedRequest)
        .then((plan) => {
          if (!disposed) {
            setExportPlan({
              status: "ready",
              requestKey: optimizedRequestKey,
              commandPreview: plan.commandPreview,
            });
          }
        })
        .catch((error: unknown) => {
          if (!disposed) {
            setExportPlan({
              status: "failed",
              requestKey: optimizedRequestKey,
              message: normalizeAppError(error).message,
            });
          }
        });
    }, 120);
    return () => {
      disposed = true;
      window.clearTimeout(timeout);
    };
  }, [isOptimizedOpen, optimizedRequest, optimizedRequestKey]);

  function openOptimizedSettings() {
    setLaunchError(null);
    setExportPlan({ status: "loading", requestKey: optimizedRequestKey });
    setIsOptimizedOpen(true);
  }

  async function handleFastCut() {
    const request: FastExportRequest = {
      sourceId: source.sourceId,
      trim: { startMicros: trim.startMicros, endMicros: trim.endMicros },
      audioTracks: selectedAudio,
      mergeAudio,
    };
    await chooseAndStart("fast", defaults.fast, request);
  }

  async function handleOptimizedRender() {
    setLaunchError(null);
    try {
      await planOptimizedExport(optimizedRequest);
    } catch (error: unknown) {
      setLaunchError(normalizeAppError(error).message);
      return;
    }
    setIsOptimizedOpen(false);
    await chooseAndStart("optimized", defaults.optimized, optimizedRequest);
  }

  function handleSavePreset() {
    const error = presetNameError(
      presetState.presets,
      presetName,
      presetState.selectedPresetId ?? undefined,
    );
    if (error) {
      setPresetError(error);
      return;
    }
    onPresetAction({
      type: presetState.selectedPresetId ? "preset-updated" : "preset-created",
      name: presetName,
    });
    setPresetError(null);
  }

  async function chooseAndStart(
    route: "fast" | "optimized",
    defaultName: string,
    request: FastExportRequest | OptimizedExportRequest,
  ) {
    setLaunchError(null);
    onNativeDialogStateChange(true);
    try {
      const output = await chooseOutputPath(defaultName);
      if (output) {
        startQueuedExport(route, request, output);
      }
    } catch (nextError: unknown) {
      setLaunchError(normalizeAppError(nextError).message);
    } finally {
      onNativeDialogStateChange(false);
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
        onCancel: () => handleCancel(id),
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
      operationIdsRef.current.set(id, next.operationId);
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
        onCancel: undefined,
      }));
    } catch (nextError: unknown) {
      if (canceledRef.current.has(id)) return;
      const normalized = normalizeAppError(nextError);
      const wasCanceled = normalized.code === "cancelled" || normalized.code === "source_replaced";
      updateToast(id, (toast) => ({
        ...toast,
        status: wasCanceled ? "canceled" : "failed",
        error: wasCanceled ? "Export canceled." : normalized.message,
        onCancel: undefined,
      }));
    }
  }

  function updateToast(id: string, update: (toast: ExportToast) => ExportToast) {
    setQueue((current) => current.map((toast) => (toast.id === id ? update(toast) : toast)));
  }

  function handleCancel(id: string) {
    canceledRef.current.add(id);
    updateToast(id, (toast) => ({
      ...toast,
      status: "canceled",
      error: "Export canceled.",
      onCancel: undefined,
    }));
    const operationId = operationIdsRef.current.get(id);
    if (operationId) {
      void cancelOperation(operationId).catch(() => undefined);
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
          aria-keyshortcuts="Control+S"
          title="Save (Ctrl+S)"
        >
          Save
        </button>
        <div className="export-config-anchor">
          <button
            className="toolbar-button export-button"
            type="button"
            onClick={() => {
              if (isOptimizedOpen) {
                setIsOptimizedOpen(false);
              } else {
                openOptimizedSettings();
              }
            }}
            aria-haspopup="dialog"
            aria-expanded={isOptimizedOpen}
            aria-keyshortcuts="Control+E"
            title="Export (Ctrl+E)"
          >
            Export
          </button>
          {isOptimizedOpen ? (
            <div className="export-dialog" role="dialog" aria-labelledby="optimized-export-title">
              <div className="export-dialog-header">
                <div>
                  <p className="section-label">Export</p>
                  <h2 id="optimized-export-title">Export</h2>
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
                    onChange={(event) => {
                      setFrameRate(rateFromValue(event.target.value));
                    }}
                  >
                    <option value="source">Match source</option>
                    {FRAME_RATE_OPTIONS.map((rate) => (
                      <option
                        key={`${rate.numerator}/${rate.denominator}`}
                        value={`${rate.numerator}/${rate.denominator}`}
                      >
                        {rate.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <section className="preset-editor" aria-labelledby="preset-editor-title">
                <div className="preset-editor-heading">
                  <span id="preset-editor-title">Preset</span>
                  <div className="preset-editor-actions">
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => {
                        onPresetAction({ type: "preset-new-started" });
                        setPresetNameDraft({ presetId: null, value: "" });
                        setPresetError(null);
                      }}
                    >
                      New
                    </button>
                    <button
                      className="secondary-button"
                      type="button"
                      disabled={!presetState.selectedPresetId}
                      onClick={() => {
                        onPresetAction({ type: "preset-deleted" });
                        setPresetError(null);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <div className="preset-editor-fields">
                  <label className="export-field">
                    <span>Saved presets</span>
                    <select
                      value={presetState.selectedPresetId ?? ""}
                      onChange={(event) => {
                        if (event.target.value) {
                          setPresetError(null);
                          onPresetAction({
                            type: "preset-selected",
                            presetId: event.target.value,
                          });
                        }
                      }}
                    >
                      <option value="" disabled>
                        Unsaved preset
                      </option>
                      {presetState.presets.map((preset) => (
                        <option key={preset.id} value={preset.id}>
                          {preset.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="export-field preset-name-field">
                    <span>Name</span>
                    <input
                      value={presetName}
                      maxLength={64}
                      onChange={(event) => {
                        setPresetNameDraft({
                          presetId: presetState.selectedPresetId,
                          value: event.target.value,
                        });
                        setPresetError(null);
                      }}
                    />
                  </label>
                  <button
                    className="secondary-button preset-save-button"
                    type="button"
                    onClick={handleSavePreset}
                  >
                    {presetState.selectedPresetId ? "Update preset" : "Create preset"}
                  </button>
                </div>
                {presetError ? (
                  <span className="export-error" role="alert">
                    {presetError}
                  </span>
                ) : null}
              </section>
              <label className="export-field export-arguments">
                <span>FFmpeg arguments</span>
                <textarea
                  value={presetState.argumentsText}
                  onChange={(event) => {
                    onPresetAction({
                      type: "arguments-changed",
                      argumentsText: event.target.value,
                    });
                  }}
                  rows={4}
                />
              </label>
              <section className="command-preview" aria-labelledby="command-preview-title">
                <span id="command-preview-title">Command preview</span>
                {currentExportPlan.status === "ready" ? (
                  <pre>{currentExportPlan.commandPreview}</pre>
                ) : currentExportPlan.status === "failed" ? (
                  <p className="export-error" role="alert">
                    {currentExportPlan.message}
                  </p>
                ) : (
                  <p role="status">Validating arguments…</p>
                )}
              </section>
              {launchError ? (
                <span className="export-error" role="alert">
                  {launchError}
                </span>
              ) : null}
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
                  disabled={currentExportPlan.status !== "ready"}
                  onClick={() => void handleOptimizedRender()}
                >
                  Export
                </button>
              </div>
            </div>
          ) : null}
        </div>
        {launchError && !isOptimizedOpen ? (
          <span className="export-error" role="alert">
            {launchError}
          </span>
        ) : null}
      </div>
    </>
  );
}

export function ExportQueue({ queue }: { queue: ExportToast[] }) {
  return (
    <section className="export-queue" aria-labelledby="export-queue-title">
      <div className="export-queue-heading">
        <h2 id="export-queue-title">Export queue</h2>
        <span>{queue.length}</span>
      </div>
      {queue.length === 0 ? (
        <p className="export-queue-empty">No exports yet.</p>
      ) : (
        <div className="export-queue-list" role="status" aria-live="polite">
          {queue.map((toast) => (
            <div
              className={`export-toast export-toast-${toast.status} ${
                toast.status === "completed" ? "export-toast-clickable" : ""
              }`}
              key={toast.id}
              role={toast.status === "completed" ? "button" : undefined}
              tabIndex={toast.status === "completed" ? 0 : undefined}
              title={toast.status === "completed" ? "Reveal file in Explorer" : undefined}
              onClick={
                toast.status === "completed"
                  ? () => void revealInExplorer(toast.path).catch(() => undefined)
                  : undefined
              }
              onKeyDown={
                toast.status === "completed"
                  ? (event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        void revealInExplorer(toast.path).catch(() => undefined);
                      }
                    }
                  : undefined
              }
            >
              <div className="export-toast-copy">
                <div className="export-toast-title">
                  <strong>{toast.filename}</strong>
                  <span>· {toast.status === "canceled" ? "Canceled" : `${toast.percentage}%`}</span>
                </div>
                <span className="export-toast-path" title={toast.path}>
                  {toast.path}
                </span>
                {toast.error && toast.status !== "canceled" ? (
                  <span className="export-toast-error">{toast.error}</span>
                ) : null}
              </div>
              <div className="export-toast-actions">
                {toast.onCancel ? (
                  <button
                    type="button"
                    onClick={toast.onCancel}
                    aria-label={`Cancel ${toast.filename}`}
                  >
                    Cancel
                  </button>
                ) : (
                  <span aria-label={`${toast.status} export`}>
                    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                      {toast.status === "completed" ? (
                        <path d="m3 8 3 3 7-7" />
                      ) : toast.status === "failed" ? (
                        <path d="M8 3v6m0 3v1" />
                      ) : (
                        <>
                          <path d="m4 4 8 8" />
                          <path d="m12 4-8 8" />
                        </>
                      )}
                    </svg>
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function outputDefaults(sourceName: string) {
  const stem = sourceName.replace(/\.[^/.]+$/, "") || "clip";
  return { fast: `${stem}-cut.mkv`, optimized: `${stem}-optimized.mp4` };
}

function isEditableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest("input, textarea, select, [contenteditable]:not([contenteditable='false'])") !==
      null
  );
}

function resolutionOptions(source: MediaInfo) {
  const sourceResolution = displayResolution(source);
  const options = [
    {
      label: `Source · ${sourceResolution.width} × ${sourceResolution.height}`,
      value: `${sourceResolution.width}x${sourceResolution.height}`,
    },
  ];
  for (const height of [2160, 1440, 1080]) {
    if (height < sourceResolution.height) {
      const width = Math.round((sourceResolution.width * height) / sourceResolution.height / 2) * 2;
      options.push({ label: `${height}p · ${width} × ${height}`, value: `${width}x${height}` });
    }
  }
  return options;
}

function displayResolution(source: MediaInfo) {
  const rotation = source.video.rotationDegrees ?? 0;
  return Math.abs(rotation) % 180 === 90
    ? { width: source.video.height, height: source.video.width }
    : { width: source.video.width, height: source.video.height };
}

function rateFromValue(value: string): FrameRate | undefined {
  if (value === "source") return undefined;
  const [numerator, denominator] = value.split("/").map(Number);
  return numerator && denominator ? { numerator, denominator } : undefined;
}

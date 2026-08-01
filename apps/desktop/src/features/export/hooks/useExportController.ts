import { useEffect, useMemo, useRef, useState } from "react";

import {
  cancelOperation,
  chooseOutputPath,
  normalizeAppError,
  planOptimizedExport,
  renderFast,
  renderOptimized,
  type ExportProgress,
  type FastExportRequest,
  type OptimizedExportRequest,
  type OutputSelection,
} from "@/lib/tauri/media";
import { isApplicationDialogOpen } from "@/lib/hotkeys";

import type { ExportPanelProps, ExportSettings, ExportToast } from "../types";
import { isEditableTarget, outputDefaults } from "../utils/export-options";
import { useTranslation } from "react-i18next";

export function useExportController({
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
  const { t } = useTranslation();
  const defaults = useMemo(() => outputDefaults(sourceName), [sourceName]);
  const [isOptimizedOpen, setIsOptimizedOpen] = useState(false);
  const [settings, setSettings] = useState<ExportSettings>({
    resolution: { width: source.video.width, height: source.video.height },
    frameRate: undefined,
    argumentsText: presetState.argumentsText,
  });
  const [launchError, setLaunchError] = useState<string | null>(null);
  const canceledRef = useRef(new Set<string>());
  const operationIdsRef = useRef(new Map<string, string>());
  const toastSequence = useRef(0);

  const masterGain = masterEnabled ? masterVolumePercent / 50 : 0;
  const selectedAudio = useMemo(
    () =>
      audioTracks
        .filter((track) => track.enabled && track.volumePercent > 0 && masterGain > 0)
        .map((track) => ({
          streamIndex: track.streamIndex,
          volumePercent: Math.min(200, Math.round(track.volumePercent * masterGain)),
        }))
        .filter((track) => track.volumePercent > 0),
    [audioTracks, masterGain],
  );

  const optimizedRequest = useMemo<OptimizedExportRequest>(
    () => ({
      sourceId: source.sourceId,
      trim: { startMicros: trim.startMicros, endMicros: trim.endMicros },
      audioTracks: selectedAudio,
      mergeAudio,
      resolution: settings.resolution,
      frameRate: settings.frameRate
        ? {
            numerator: settings.frameRate.numerator,
            denominator: settings.frameRate.denominator,
          }
        : undefined,
      arguments: presetState.argumentsText,
    }),
    [
      mergeAudio,
      presetState.argumentsText,
      selectedAudio,
      settings.frameRate,
      settings.resolution,
      source.sourceId,
      trim.endMicros,
      trim.startMicros,
    ],
  );

  const [commandPreview, setCommandPreview] = useState("");
  const [commandPreviewError, setCommandPreviewError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOptimizedOpen) return;
    let active = true;
    void planOptimizedExport(optimizedRequest)
      .then((plan) => {
        if (active) {
          setCommandPreview(plan.commandPreview);
          setCommandPreviewError(null);
        }
      })
      .catch((error: unknown) => {
        if (active) setCommandPreviewError(normalizeAppError(error).message);
      });
    return () => {
      active = false;
    };
  }, [isOptimizedOpen, optimizedRequest]);

  function updateSettings(nextSettings: ExportSettings) {
    setSettings({ ...nextSettings, argumentsText: presetState.argumentsText });
    if (nextSettings.argumentsText !== presetState.argumentsText) {
      onPresetAction({ type: "arguments-changed", argumentsText: nextSettings.argumentsText });
    }
  }

  async function startFastCut() {
    const request: FastExportRequest = {
      sourceId: source.sourceId,
      trim: { startMicros: trim.startMicros, endMicros: trim.endMicros },
      audioTracks: selectedAudio,
      mergeAudio,
    };
    await chooseAndStart("fast", defaults.fast, request);
  }

  async function startOptimizedRender() {
    setIsOptimizedOpen(false);
    await chooseAndStart("optimized", defaults.optimized, optimizedRequest);
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
      if (output) startQueuedExport(route, request, output);
    } catch (error: unknown) {
      setLaunchError(normalizeAppError(error).message);
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
        onCancel: () => cancelExport(id),
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
    const onProgress = (progress: ExportProgress) => {
      if (canceledRef.current.has(id)) {
        void cancelOperation(progress.operationId).catch(() => undefined);
        return;
      }
      updateToast(id, (toast) => ({
        ...toast,
        operationId: progress.operationId,
        percentage: Math.round(progress.percentage),
      }));
      operationIdsRef.current.set(id, progress.operationId);
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
    } catch (error: unknown) {
      if (canceledRef.current.has(id)) return;
      const normalized = normalizeAppError(error);
      const wasCanceled = normalized.code === "cancelled" || normalized.code === "source_replaced";
      updateToast(id, (toast) => ({
        ...toast,
        status: wasCanceled ? "canceled" : "failed",
        error: wasCanceled ? t("export.canceledMessage") : normalized.message,
        onCancel: undefined,
      }));
    }
  }

  function updateToast(id: string, update: (toast: ExportToast) => ExportToast) {
    setQueue((current) => current.map((toast) => (toast.id === id ? update(toast) : toast)));
  }

  function cancelExport(id: string) {
    canceledRef.current.add(id);
    updateToast(id, (toast) => ({
      ...toast,
      status: "canceled",
      error: t("export.canceledMessage"),
      onCancel: undefined,
    }));
    const operationId = operationIdsRef.current.get(id);
    if (operationId) void cancelOperation(operationId).catch(() => undefined);
  }

  function openOptimizedDialog() {
    setLaunchError(null);
    setIsOptimizedOpen(true);
  }

  useEffect(() => {
    function handleExportShortcut(event: KeyboardEvent) {
      if (isApplicationDialogOpen()) return;
      if (!event.ctrlKey || event.altKey || event.metaKey || isEditableTarget(event.target)) return;
      if (event.key.toLowerCase() === "s") {
        event.preventDefault();
        void startFastCut();
      } else if (event.key.toLowerCase() === "e") {
        event.preventDefault();
        openOptimizedDialog();
      }
    }

    window.addEventListener("keydown", handleExportShortcut, true);
    return () => window.removeEventListener("keydown", handleExportShortcut, true);
  });

  return {
    isOptimizedOpen,
    setIsOptimizedOpen,
    settings: { ...settings, argumentsText: presetState.argumentsText },
    commandPreview,
    commandPreviewError,
    setSettings: updateSettings,
    launchError,
    startFastCut,
    startOptimizedRender,
    openOptimizedDialog,
  };
}

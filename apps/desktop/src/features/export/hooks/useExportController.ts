import { useEffect, useMemo, useRef, useState } from "react";

import {
  chooseOutputPath,
  normalizeAppError,
  planOptimizedExport,
  type FastExportRequest,
  type OptimizedExportRequest,
  type OutputSelection,
} from "@/lib/tauri/media";
import { useKeyboardShortcut } from "@/lib/hooks/useKeyboardShortcut";

import type { ExportPanelProps, ExportSettings } from "../types";
import { outputDefaults } from "../utils/export-options";
import { cancelQueuedExport, enqueueExport } from "../utils/export-queue";
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
    // The controller is remounted when a new source is imported. Include the
    // source identity so the new controller cannot reuse an old queue item id
    // and route later progress into the previous export.
    const id = `export-toast-${source.sourceId}-${++toastSequence.current}`;
    setQueue((current) => [
      ...current,
      {
        id,
        operationId: null,
        filename: output.displayName,
        path: output.displayPath,
        status: "queued",
        startedAt: null,
        durationMs: null,
        progressPercent: 0,
        onCancel: () => cancelQueuedExport(id),
      },
    ]);
    enqueueExport({
      id,
      route,
      request,
      output,
      setQueue,
      canceledMessage: t("export.canceledMessage"),
    });
  }

  function openOptimizedDialog() {
    setLaunchError(null);
    setIsOptimizedOpen(true);
  }

  useKeyboardShortcut(
    (event) => event.key.toLowerCase() === "s" && event.ctrlKey,
    () => startFastCut(),
  );
  useKeyboardShortcut(
    (event) => event.key.toLowerCase() === "e" && event.ctrlKey,
    openOptimizedDialog,
  );

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

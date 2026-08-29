import { Channel, invoke } from "@tauri-apps/api/core";
import type { UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWebview } from "@tauri-apps/api/webview";

import type { SourceRef } from "@/domain/source";

import type {
  AudioPreviewDescriptor,
  ExportProgress,
  ExportResult,
  FastExportRequest,
  MediaCapabilities,
  MediaInfo,
  OptimizedExportPlan,
  OptimizedExportRequest,
  OutputSelection,
  PreviewDescriptor,
  SourceDropEvent,
  WaveformResult,
} from "./media.types";
import {
  normalizeAppError,
  parseAudioPreviewDescriptors,
  parseExportProgress,
  parseExportResult,
  parseMediaCapabilities,
  parseMediaInfo,
  parseOptimizedExportPlan,
  parseOutputSelection,
  parsePreviewDescriptor,
  parseSourceRef,
  parseSourceRefs,
  parseWaveformResults,
} from "./media.utils";

export async function chooseSource(): Promise<SourceRef[]> {
  try {
    const value = await invoke<unknown>("choose_source");
    return value === null ? [] : parseSourceRefs(value);
  } catch (error: unknown) {
    throw normalizeAppError(error);
  }
}

export async function checkMediaCapabilities(): Promise<MediaCapabilities> {
  try {
    return parseMediaCapabilities(await invoke<unknown>("check_media_capabilities"));
  } catch (error: unknown) {
    throw normalizeAppError(error);
  }
}

export async function inspectMedia(sourcePath: string): Promise<MediaInfo> {
  try {
    return parseMediaInfo(await invoke<unknown>("inspect_media", { sourcePath }));
  } catch (error: unknown) {
    throw normalizeAppError(error);
  }
}

export async function activateSourcePath(sourcePath: string): Promise<SourceRef> {
  try {
    return parseSourceRef(await invoke<unknown>("activate_source_path", { sourcePath }));
  } catch (error: unknown) {
    throw normalizeAppError(error);
  }
}

export async function chooseOutputPath(defaultName: string): Promise<OutputSelection | null> {
  try {
    const value = await invoke<unknown>("choose_output_path", { defaultName });
    return value === null ? null : parseOutputSelection(value);
  } catch (error: unknown) {
    throw normalizeAppError(error);
  }
}

export async function renderFast(
  request: FastExportRequest,
  outputId: string,
  onProgress: (progress: ExportProgress) => void,
): Promise<ExportResult> {
  return render("render_fast", request, outputId, onProgress);
}

export async function renderOptimized(
  request: OptimizedExportRequest,
  outputId: string,
  onProgress: (progress: ExportProgress) => void,
): Promise<ExportResult> {
  return render("render_optimized", request, outputId, onProgress);
}

export async function planOptimizedExport(
  request: OptimizedExportRequest,
): Promise<OptimizedExportPlan> {
  try {
    return parseOptimizedExportPlan(await invoke<unknown>("plan_optimized_export", { request }));
  } catch (error: unknown) {
    throw normalizeAppError(error);
  }
}

export async function cancelOperation(operationId: string): Promise<void> {
  try {
    await invoke("cancel_operation", { operationId });
  } catch (error: unknown) {
    throw normalizeAppError(error);
  }
}

export async function reserveExportSource(sourcePath: string): Promise<void> {
  try {
    await invoke("reserve_export_source", { sourcePath });
  } catch (error: unknown) {
    throw normalizeAppError(error);
  }
}

export async function releaseExportSource(sourcePath: string): Promise<void> {
  try {
    await invoke("release_export_source", { sourcePath });
  } catch (error: unknown) {
    throw normalizeAppError(error);
  }
}

export async function openFileLocation(path: string): Promise<void> {
  try {
    await invoke("open_file_location", { path });
  } catch (error: unknown) {
    throw normalizeAppError(error);
  }
}

async function render(
  command: "render_fast" | "render_optimized",
  request: FastExportRequest | OptimizedExportRequest,
  outputId: string,
  onProgress: (progress: ExportProgress) => void,
): Promise<ExportResult> {
  try {
    const channel = new Channel<unknown>((value) => onProgress(parseExportProgress(value)));
    return parseExportResult(
      await invoke<unknown>(command, { request, outputId, onProgress: channel }),
    );
  } catch (error: unknown) {
    throw normalizeAppError(error);
  }
}

export async function prepareSourcePreview(sourcePath: string): Promise<PreviewDescriptor> {
  try {
    return parsePreviewDescriptor(
      await invoke<unknown>("prepare_source_preview", {
        sourcePath,
      }),
    );
  } catch (error: unknown) {
    throw normalizeAppError(error);
  }
}

export async function prepareAudioPreviews(
  sourcePath: string,
  streamIndexes: number[],
): Promise<AudioPreviewDescriptor[]> {
  try {
    return parseAudioPreviewDescriptors(
      await invoke<unknown>("prepare_audio_previews", { sourcePath, streamIndexes }),
    );
  } catch (error: unknown) {
    throw normalizeAppError(error);
  }
}

export async function prepareProxyPreview(sourcePath: string): Promise<PreviewDescriptor> {
  try {
    return parsePreviewDescriptor(
      await invoke<unknown>("prepare_proxy_preview", {
        sourcePath,
      }),
    );
  } catch (error: unknown) {
    throw normalizeAppError(error);
  }
}

export async function prepareWaveforms(
  sourcePath: string,
  jobId: string,
  streamIndexes: number[],
  width: number,
): Promise<WaveformResult[]> {
  try {
    return parseWaveformResults(
      await invoke<unknown>("prepare_waveforms", {
        sourcePath,
        jobId,
        streamIndexes,
        width,
      }),
    );
  } catch (error: unknown) {
    throw normalizeAppError(error);
  }
}

export async function listenForSourceDrops(
  onEvent: (event: SourceDropEvent) => void,
): Promise<UnlistenFn> {
  return getCurrentWebview().onDragDropEvent((event) => {
    switch (event.payload.type) {
      case "enter":
        onEvent({ status: "drag", active: true });
        break;
      case "leave":
        onEvent({ status: "drag", active: false });
        break;
      case "drop": {
        onEvent({ status: "drag", active: false });
        if (event.payload.paths.length === 0) {
          onEvent({
            status: "failed",
            error: {
              code: "invalid_request",
              message: "Drop a video file instead of an empty selection.",
            },
          });
          break;
        }
        void importDroppedSources(event.payload.paths).then(
          (sources) => onEvent({ status: "selected", sources }),
          (error: unknown) => onEvent({ status: "failed", error: normalizeAppError(error) }),
        );
        break;
      }
      case "over":
        break;
    }
  });
}

async function importDroppedSources(paths: string[]): Promise<SourceRef[]> {
  try {
    return parseSourceRefs(await invoke<unknown>("import_dropped_sources", { paths }));
  } catch (error: unknown) {
    throw normalizeAppError(error);
  }
}

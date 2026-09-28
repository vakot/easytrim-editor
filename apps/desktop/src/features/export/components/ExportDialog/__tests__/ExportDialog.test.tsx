import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { describe, expect, it, vi } from "vitest";

const { analyzeAudioLoudness, planOptimizedExport } = vi.hoisted(() => ({
  analyzeAudioLoudness: vi.fn(),
  planOptimizedExport: vi.fn(),
}));

vi.mock("@/lib/tauri/media", () => ({
  chooseOutputPath: vi.fn(),
  analyzeAudioLoudness,
  normalizeAppError: (error: unknown) => ({ code: "internal", message: String(error) }),
  planOptimizedExport,
  reserveExportSource: vi.fn(),
}));

import { TooltipProvider } from "@/components/ui/tooltip";

import { sourceReady, sourceSelected } from "@/app/store/actions/source-actions";
import { createDefaultEditorSnapshot } from "@/app/store/integration/editor-snapshot";
import {
  audioMergeToggled,
  audioTrackVolumeChanged,
  masterVolumeChanged,
} from "@/app/store/slices/audio-slice";
import { cropChanged } from "@/app/store/slices/crop-slice";
import {
  activeEditingInstanceChanged,
  editingInstancesAdded,
} from "@/app/store/slices/editing-instances-slice";
import { trimChanged } from "@/app/store/slices/trim-slice";
import { createAppStore } from "@/app/store/store";
import { openOptimizedExportDialog } from "@/app/store/thunks/export-thunks";
import { firstSource, media, mediaWithAudio } from "@/test/source.fixtures";

import { ExportDialog } from "../ExportDialog";

describe("ExportDialog", () => {
  it("requests one command preview when one dialog open is dispatched", async () => {
    planOptimizedExport.mockResolvedValue({ commandPreview: "ffmpeg preview" });
    const store = createAppStore({
      getItem: async () => null,
      setItem: async () => undefined,
      removeItem: async () => undefined,
    });

    store.dispatch(sourceSelected({ source: firstSource }));
    store.dispatch(sourceReady({ loadToken: 1, media: media(firstSource.sourcePath) }));
    store.dispatch(
      editingInstancesAdded([
        {
          exportAttempts: [],
          id: "instance-1",
          origin: "source-import",
          snapshot: createDefaultEditorSnapshot(firstSource, false),
          sourceAvailability: "available",
        },
      ]),
    );
    store.dispatch(activeEditingInstanceChanged("instance-1"));

    render(
      <Provider store={store}>
        <TooltipProvider>
          <ExportDialog />
        </TooltipProvider>
      </Provider>,
    );

    await store.dispatch(openOptimizedExportDialog());

    expect(planOptimizedExport).toHaveBeenCalledTimes(1);
  });

  it("uses crop dimensions and aspect ratio for optimized resolution controls", async () => {
    planOptimizedExport.mockResolvedValue({ commandPreview: "ffmpeg preview" });
    const store = createAppStore({
      getItem: async () => null,
      setItem: async () => undefined,
      removeItem: async () => undefined,
    });

    const croppedMedia = {
      ...media(firstSource.sourcePath),
      video: { ...media(firstSource.sourcePath).video, width: 5_120, height: 1_440 },
    };

    store.dispatch(sourceSelected({ source: firstSource }));
    store.dispatch(sourceReady({ loadToken: 1, media: croppedMedia }));
    store.dispatch(
      editingInstancesAdded([
        {
          exportAttempts: [],
          id: "instance-1",
          origin: "source-import",
          snapshot: createDefaultEditorSnapshot(firstSource, false),
          sourceAvailability: "available",
        },
      ]),
    );
    store.dispatch(activeEditingInstanceChanged("instance-1"));
    store.dispatch(
      cropChanged({
        crop: { x: 0, y: 0, width: 0.5, height: 1 },
        resolution: { width: 2_560, height: 1_440 },
      }),
    );

    render(
      <Provider store={store}>
        <TooltipProvider>
          <ExportDialog />
        </TooltipProvider>
      </Provider>,
    );

    await store.dispatch(openOptimizedExportDialog());

    expect(screen.getByRole("spinbutton", { name: "Width" })).toHaveValue(2560);
    expect(screen.getByRole("spinbutton", { name: "Height" })).toHaveValue(1440);

    fireEvent.change(screen.getByRole("spinbutton", { name: "Width" }), {
      target: { value: "1920" },
    });
    await waitFor(() =>
      expect(screen.getByRole("spinbutton", { name: "Height" })).toHaveValue(1080),
    );

    fireEvent.click(screen.getByRole("combobox", { name: "Resolution" }));
    expect(screen.getByRole("option", { name: /2560.*1440.*source/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /1080p.*1920.*1080/ })).toBeInTheDocument();
  });

  it("analyzes the selected segment with the same audio selection and mix levels as export", async () => {
    planOptimizedExport.mockResolvedValue({ commandPreview: "ffmpeg preview" });
    analyzeAudioLoudness.mockResolvedValue({ integratedLufs: -18.2, truePeakDb: -2.1 });
    const store = createAppStore({
      getItem: async () => null,
      setItem: async () => undefined,
      removeItem: async () => undefined,
    });

    store.dispatch(sourceSelected({ source: firstSource }));
    store.dispatch(sourceReady({ loadToken: 1, media: mediaWithAudio(firstSource.sourcePath) }));
    store.dispatch(audioTrackVolumeChanged({ streamIndex: 2, volumePercent: 75 }));
    store.dispatch(masterVolumeChanged({ volumePercent: 80 }));
    store.dispatch(audioMergeToggled());
    store.dispatch(
      trimChanged({
        trim: { startMicros: 1_000_000, endMicros: 4_000_000, sourceDurationMicros: 5_000_000 },
      }),
    );
    store.dispatch(
      editingInstancesAdded([
        {
          exportAttempts: [],
          id: "instance-1",
          origin: "source-import",
          snapshot: createDefaultEditorSnapshot(firstSource, false),
          sourceAvailability: "available",
        },
      ]),
    );
    store.dispatch(activeEditingInstanceChanged("instance-1"));

    render(
      <Provider store={store}>
        <TooltipProvider>
          <ExportDialog />
        </TooltipProvider>
      </Provider>,
    );

    await store.dispatch(openOptimizedExportDialog());
    const presetSelect = screen.getByRole("combobox", { name: "Loudness" });
    const analyzeButton = screen.getByRole("button", { name: "Analyze loudness" });
    fireEvent.click(presetSelect);
    fireEvent.click(screen.getByRole("option", { name: /Streaming/ }));
    await waitFor(() =>
      expect(
        store.getState().editingInstances.entities["instance-1"]?.optimizedSettings,
      ).toMatchObject({ loudnessPreset: "streaming" }),
    );
    expect(analyzeButton).toBeDisabled();

    fireEvent.click(presetSelect);
    fireEvent.click(screen.getByRole("option", { name: "Default" }));
    await waitFor(() =>
      expect(
        store.getState().editingInstances.entities["instance-1"]?.optimizedSettings,
      ).toMatchObject({ loudnessPreset: undefined }),
    );
    expect(analyzeButton).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Analyze loudness" }));

    await waitFor(() =>
      expect(analyzeAudioLoudness).toHaveBeenCalledWith(
        {
          audioTracks: [
            { streamIndex: 2, volumePercent: 120 },
            { streamIndex: 4, volumePercent: 80 },
          ],
          mergeAudio: true,
          sourcePath: firstSource.sourcePath,
          trim: { startMicros: 1_000_000, endMicros: 4_000_000 },
        },
        expect.any(AbortSignal),
      ),
    );
    await waitFor(() => expect(presetSelect).toHaveTextContent("Default · −18.2 LUFS / −2.1 dBTP"));

    expect(await screen.findByRole("button", { name: "Analyzed" })).toBeDisabled();
    fireEvent.click(presetSelect);
    expect(
      screen.getByRole("option", { name: "Default · −18.2 LUFS / −2.1 dBTP" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Web video · −14 LUFS / −1 dBTP" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("option", { name: "Streaming · −16 LUFS / −1.5 dBTP" }));
    await waitFor(() =>
      expect(
        store.getState().editingInstances.entities["instance-1"]?.optimizedSettings,
      ).toMatchObject({ loudnessPreset: "streaming" }),
    );
    expect(analyzeButton).toBeDisabled();

    fireEvent.click(presetSelect);
    fireEvent.click(screen.getByRole("option", { name: /Broadcast/ }));
    await waitFor(() =>
      expect(
        store.getState().editingInstances.entities["instance-1"]?.optimizedSettings,
      ).toMatchObject({ loudnessPreset: "broadcast" }),
    );

    fireEvent.click(presetSelect);
    fireEvent.click(screen.getByRole("option", { name: "Default · −18.2 LUFS / −2.1 dBTP" }));
    await waitFor(() =>
      expect(
        store.getState().editingInstances.entities["instance-1"]?.optimizedSettings,
      ).toMatchObject({ loudnessPreset: undefined }),
    );
    await waitFor(
      () => expect(screen.queryByRole("button", { name: "Analyzed" })).not.toBeInTheDocument(),
      { timeout: 2_000 },
    );
  });

  it("aborts loudness analysis when the trim changes or the dialog closes", async () => {
    planOptimizedExport.mockResolvedValue({ commandPreview: "ffmpeg preview" });
    const analysisSignals: AbortSignal[] = [];
    analyzeAudioLoudness.mockImplementation(
      (_request: unknown, signal: AbortSignal) =>
        new Promise((resolve) => {
          analysisSignals.push(signal);
          signal.addEventListener("abort", () => resolve({ integratedLufs: -18, truePeakDb: -2 }), {
            once: true,
          });
        }),
    );
    const store = createAppStore({
      getItem: async () => null,
      setItem: async () => undefined,
      removeItem: async () => undefined,
    });

    store.dispatch(sourceSelected({ source: firstSource }));
    store.dispatch(sourceReady({ loadToken: 1, media: mediaWithAudio(firstSource.sourcePath) }));
    store.dispatch(
      editingInstancesAdded([
        {
          exportAttempts: [],
          id: "instance-1",
          origin: "source-import",
          snapshot: createDefaultEditorSnapshot(firstSource, false),
          sourceAvailability: "available",
        },
      ]),
    );
    store.dispatch(activeEditingInstanceChanged("instance-1"));

    render(
      <Provider store={store}>
        <TooltipProvider>
          <ExportDialog />
        </TooltipProvider>
      </Provider>,
    );

    await store.dispatch(openOptimizedExportDialog());
    fireEvent.click(screen.getByRole("button", { name: "Analyze loudness" }));
    await waitFor(() => expect(analysisSignals).toHaveLength(1));

    store.dispatch(
      trimChanged({
        trim: { startMicros: 500_000, endMicros: 4_500_000, sourceDurationMicros: 5_000_000 },
      }),
    );
    await waitFor(() => expect(analysisSignals[0]?.aborted).toBe(true));

    fireEvent.click(screen.getByRole("button", { name: "Analyze loudness" }));
    await waitFor(() => expect(analysisSignals).toHaveLength(2));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(analysisSignals[1]?.aborted).toBe(true));
  });

  it("shows a destructive retry on failure and closes the success state after one second", async () => {
    planOptimizedExport.mockResolvedValue({ commandPreview: "ffmpeg preview" });
    let resolveAnalysis:
      ((result: { integratedLufs: number; truePeakDb: number }) => void) | undefined;

    analyzeAudioLoudness.mockRejectedValueOnce(new Error("Analysis failed")).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveAnalysis = resolve;
        }),
    );
    const store = createAppStore({
      getItem: async () => null,
      setItem: async () => undefined,
      removeItem: async () => undefined,
    });

    store.dispatch(sourceSelected({ source: firstSource }));
    store.dispatch(sourceReady({ loadToken: 1, media: mediaWithAudio(firstSource.sourcePath) }));
    store.dispatch(
      editingInstancesAdded([
        {
          exportAttempts: [],
          id: "instance-1",
          origin: "source-import",
          snapshot: createDefaultEditorSnapshot(firstSource, false),
          sourceAvailability: "available",
        },
      ]),
    );
    store.dispatch(activeEditingInstanceChanged("instance-1"));

    render(
      <Provider store={store}>
        <TooltipProvider>
          <ExportDialog />
        </TooltipProvider>
      </Provider>,
    );

    await store.dispatch(openOptimizedExportDialog());
    fireEvent.click(screen.getByRole("button", { name: "Analyze loudness" }));
    const retryButton = await screen.findByRole("button", { name: "Retry" });
    expect(retryButton).toHaveAttribute("data-variant", "destructive");

    fireEvent.click(retryButton);
    expect(await screen.findByRole("button", { name: "Analyzing…" })).toBeDisabled();
    await waitFor(() => expect(resolveAnalysis).toBeDefined());
    resolveAnalysis?.({ integratedLufs: -18, truePeakDb: -2 });

    const successButton = await screen.findByRole("button", { name: "Analyzed" });
    expect(successButton).toHaveAttribute("data-variant", "success");
    await waitFor(
      () => expect(screen.queryByRole("button", { name: "Analyzed" })).not.toBeInTheDocument(),
      { timeout: 2_000 },
    );
  });
});

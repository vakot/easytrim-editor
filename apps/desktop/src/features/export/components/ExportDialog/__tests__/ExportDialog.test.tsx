import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { describe, expect, it, vi } from "vitest";

const { chooseGifOutputPath, chooseOutputPath, planGifExport, planOptimizedExport } = vi.hoisted(
  () => ({
    chooseGifOutputPath: vi.fn(),
    chooseOutputPath: vi.fn(),
    planGifExport: vi.fn(),
    planOptimizedExport: vi.fn(),
  }),
);

vi.mock("@/lib/tauri/media", () => ({
  chooseGifOutputPath,
  chooseOutputPath,
  normalizeAppError: (error: unknown) => ({ code: "internal", message: String(error) }),
  planGifExport,
  planOptimizedExport,
  reserveExportSource: vi.fn(),
}));

import { TooltipProvider } from "@/components/ui/tooltip";

import { sourceReady, sourceSelected } from "@/app/store/actions/source-actions";
import { createDefaultEditorSnapshot } from "@/app/store/integration/editor-snapshot";
import { cropChanged } from "@/app/store/slices/crop-slice";
import {
  activeEditingInstanceChanged,
  editingInstancesAdded,
} from "@/app/store/slices/editing-instances-slice";
import { exportLaunchFailed } from "@/app/store/slices/export-slice";
import { createAppStore } from "@/app/store/store";
import { openGifExportDialog, openOptimizedExportDialog } from "@/app/store/thunks/export-thunks";
import { firstSource, media } from "@/test/source.fixtures";

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

    expect(screen.getByTestId("video-export-options")).toBeInTheDocument();
    expect(screen.queryByTestId("gif-export-options")).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Frame rate" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Frame rate" })).toHaveValue("");
    expect(screen.getByRole("combobox", { name: "Frame rate" })).toHaveAttribute(
      "placeholder",
      "Match source",
    );
    fireEvent.click(screen.getByRole("combobox", { name: "Frame rate" }));
    expect(screen.queryByRole("option", { name: "Match source" })).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: "6 FPS" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "10 FPS" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "15 FPS" })).toBeInTheDocument();
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

  it("uses crop-aware shared resolution controls for GIF without planning optimized export", async () => {
    planOptimizedExport.mockClear();
    planGifExport.mockClear();
    planGifExport.mockResolvedValue({ commandPreview: "ffmpeg gif preview" });
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

    await store.dispatch(openGifExportDialog());

    expect(screen.getByTestId("gif-export-options")).toBeInTheDocument();
    expect(screen.queryByTestId("video-export-options")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Export selected segment as GIF" })).toBeVisible();
    expect(screen.getByRole("spinbutton", { name: "Width" })).toHaveValue(2_560);
    expect(screen.getByRole("spinbutton", { name: "Height" })).toHaveValue(1_440);
    expect(screen.getByRole("textbox", { name: "Command preview" })).toHaveValue(
      "ffmpeg gif preview",
    );
    expect(screen.getByRole("combobox", { name: "Frame rate" })).toBeInTheDocument();
    expect(planOptimizedExport).not.toHaveBeenCalled();
    expect(planGifExport).toHaveBeenCalledWith(
      expect.objectContaining({
        crop: { height: 1, width: 0.5, x: 0, y: 0 },
        resolution: { height: 1_440, width: 2_560 },
      }),
    );

    fireEvent.change(screen.getByRole("spinbutton", { name: "Width" }), {
      target: { value: "1920" },
    });
    await waitFor(() =>
      expect(screen.getByRole("spinbutton", { name: "Height" })).toHaveValue(1080),
    );
    await waitFor(() =>
      expect(planGifExport).toHaveBeenLastCalledWith(
        expect.objectContaining({ resolution: { height: 1080, width: 1920 } }),
      ),
    );
  });

  it("keeps GIF and optimized resolution and frame-rate selections independent", async () => {
    planOptimizedExport.mockResolvedValue({ commandPreview: "ffmpeg optimized preview" });
    planGifExport.mockResolvedValue({ commandPreview: "ffmpeg gif preview" });
    const store = createAppStore({
      getItem: async () => null,
      setItem: async () => undefined,
      removeItem: async () => undefined,
    });

    const optimizedSettings = {
      frameRate: { denominator: 1, numerator: 24 },
      resolution: { height: 720, width: 1280 },
    };

    const gifSettings = {
      frameRate: { denominator: 1, numerator: 15 },
      resolution: { height: 360, width: 640 },
    };

    store.dispatch(sourceSelected({ source: firstSource }));
    store.dispatch(sourceReady({ loadToken: 1, media: media(firstSource.sourcePath) }));
    store.dispatch(
      editingInstancesAdded([
        {
          exportAttempts: [],
          gifSettings,
          id: "instance-1",
          optimizedSettings,
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

    await store.dispatch(openGifExportDialog());
    await waitFor(() =>
      expect(planGifExport).toHaveBeenLastCalledWith(
        expect.objectContaining({
          frameRate: gifSettings.frameRate,
          resolution: gifSettings.resolution,
        }),
      ),
    );
    expect(screen.getByRole("spinbutton", { name: "Width" })).toHaveValue(640);
    expect(screen.getByRole("spinbutton", { name: "Height" })).toHaveValue(360);
    expect(screen.getByRole("combobox", { name: "Quality preset" })).toHaveTextContent("Balanced");
    fireEvent.click(screen.getByRole("combobox", { name: "Quality preset" }));
    fireEvent.click(screen.getByRole("option", { name: "Compact" }));
    await waitFor(() =>
      expect(store.getState().editingInstances.entities["instance-1"]?.gifSettings).toMatchObject({
        gifPreset: "compact",
        paletteColors: 64,
        paletteStatsMode: "diff",
        dithering: "bayer",
      }),
    );
    fireEvent.click(screen.getByRole("combobox", { name: "Maximum palette colors" }));
    fireEvent.click(screen.getByRole("option", { name: "32" }));
    await waitFor(() =>
      expect(store.getState().editingInstances.entities["instance-1"]?.gifSettings).toMatchObject({
        gifPreset: "custom",
        paletteColors: 32,
      }),
    );
    await waitFor(() =>
      expect(planGifExport).toHaveBeenLastCalledWith(
        expect.objectContaining({
          gifPreset: "custom",
          paletteColors: 32,
          paletteStatsMode: "diff",
          dithering: "bayer",
        }),
      ),
    );
    expect(screen.getByRole("combobox", { name: "Quality preset" })).toHaveTextContent("Custom");
    fireEvent.change(screen.getByRole("spinbutton", { name: "Width" }), {
      target: { value: "800" },
    });
    await waitFor(() =>
      expect(store.getState().editingInstances.entities["instance-1"]?.gifSettings).toEqual({
        frameRate: gifSettings.frameRate,
        gifPreset: "custom",
        paletteColors: 32,
        paletteStatsMode: "diff",
        dithering: "bayer",
        resolution: { height: 450, width: 800 },
      }),
    );
    const frameRateInput = screen.getByRole("combobox", { name: "Frame rate" });
    fireEvent.click(frameRateInput);
    fireEvent.change(frameRateInput, { target: { value: "30" } });
    fireEvent.click(screen.getByRole("option", { name: "30 FPS" }));
    await waitFor(() =>
      expect(store.getState().editingInstances.entities["instance-1"]?.gifSettings).toEqual({
        frameRate: { denominator: 1, numerator: 30 },
        gifPreset: "custom",
        paletteColors: 32,
        paletteStatsMode: "diff",
        dithering: "bayer",
        resolution: { height: 450, width: 800 },
      }),
    );
    await waitFor(() =>
      expect(planGifExport).toHaveBeenLastCalledWith(
        expect.objectContaining({ frameRate: { denominator: 1, numerator: 30 } }),
      ),
    );
    expect(store.getState().editingInstances.entities["instance-1"]?.optimizedSettings).toEqual(
      optimizedSettings,
    );
    fireEvent.change(frameRateInput, { target: { value: "12.5" } });
    await waitFor(() =>
      expect(
        store.getState().editingInstances.entities["instance-1"]?.gifSettings?.frameRate,
      ).toEqual({
        denominator: 2,
        numerator: 25,
      }),
    );
    await waitFor(() =>
      expect(planGifExport).toHaveBeenLastCalledWith(
        expect.objectContaining({ frameRate: { denominator: 2, numerator: 25 } }),
      ),
    );
    fireEvent.change(frameRateInput, { target: { value: "121" } });
    expect(
      screen.getByText("Enter a frame rate greater than 0 and no more than 120 FPS."),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "GIF Export" })).toBeDisabled();
    fireEvent.change(frameRateInput, { target: { value: "" } });
    await waitFor(() =>
      expect(store.getState().editingInstances.entities["instance-1"]?.gifSettings?.frameRate).toBe(
        undefined,
      ),
    );
    expect(frameRateInput).toHaveValue("");
    expect(screen.getByRole("button", { name: "GIF Export" })).toBeEnabled();

    await store.dispatch(openOptimizedExportDialog());
    await waitFor(() =>
      expect(planOptimizedExport).toHaveBeenLastCalledWith(
        expect.objectContaining({
          frameRate: optimizedSettings.frameRate,
          resolution: optimizedSettings.resolution,
        }),
      ),
    );
    expect(screen.getByRole("spinbutton", { name: "Width" })).toHaveValue(1280);
    expect(screen.getByRole("spinbutton", { name: "Height" })).toHaveValue(720);
    expect(screen.getByRole("combobox", { name: "Frame rate" })).toHaveValue("24 FPS");
    expect(screen.getByRole("button", { name: "Export" })).toBeEnabled();
    fireEvent.change(screen.getByRole("combobox", { name: "Frame rate" }), {
      target: { value: "20.5" },
    });
    await waitFor(() =>
      expect(planOptimizedExport).toHaveBeenLastCalledWith(
        expect.objectContaining({ frameRate: { denominator: 2, numerator: 41 } }),
      ),
    );
  });

  it("starts the export action for the active route", async () => {
    planOptimizedExport.mockResolvedValue({ commandPreview: "ffmpeg optimized preview" });
    planGifExport.mockResolvedValue({ commandPreview: "ffmpeg gif preview" });
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

    await store.dispatch(openGifExportDialog());
    fireEvent.click(screen.getByRole("button", { name: "GIF Export" }));
    await waitFor(() => expect(chooseGifOutputPath).toHaveBeenCalledTimes(1));
    expect(chooseOutputPath).not.toHaveBeenCalled();

    chooseGifOutputPath.mockClear();
    chooseOutputPath.mockClear();
    await store.dispatch(openOptimizedExportDialog());
    fireEvent.click(screen.getByRole("button", { name: "Export" }));
    await waitFor(() => expect(chooseOutputPath).toHaveBeenCalledTimes(1));
    expect(chooseGifOutputPath).not.toHaveBeenCalled();
  });

  it("preserves dialog cancel and launch-error handling", async () => {
    planOptimizedExport.mockResolvedValue({ commandPreview: "ffmpeg preview" });
    planGifExport.mockResolvedValue({ commandPreview: "ffmpeg gif preview" });
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
    store.dispatch(
      exportLaunchFailed({
        code: "internal",
        messageId: "export.fileLocationCouldNotBeOpened",
      }),
    );
    await waitFor(() =>
      expect(screen.getByText("Could not open the file location")).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() =>
      expect(screen.queryByRole("heading", { name: "Export" })).not.toBeInTheDocument(),
    );
    expect(store.getState().export.optimizedDialogOpen).toBe(false);

    await store.dispatch(openGifExportDialog());
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(store.getState().export.optimizedDialogOpen).toBe(false));
    expect(store.getState().export.dialogRoute).toBe("gif");
  });
});

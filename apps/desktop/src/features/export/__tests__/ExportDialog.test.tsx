import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { describe, expect, it, vi } from "vitest";

const planOptimizedExport = vi.hoisted(() => vi.fn());

vi.mock("@/lib/tauri/media", () => ({
  chooseOutputPath: vi.fn(),
  normalizeAppError: (error: unknown) => ({ code: "internal", message: String(error) }),
  planOptimizedExport,
  reserveExportSource: vi.fn(),
}));

import { TooltipProvider } from "@/components/ui/tooltip";

import { sourceReady, sourceSelected } from "@/app/store/actions/source-actions";
import { createDefaultEditorSnapshot } from "@/app/store/integration/editor-snapshot";
import { cropChanged } from "@/app/store/slices/crop-slice";
import { activeEditingInstanceChanged, editingInstancesAdded } from "@/app/store/slices/editing-instances-slice";
import { createAppStore } from "@/app/store/store";
import { openOptimizedExportDialog } from "@/app/store/thunks/export-thunks";
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
    store.dispatch(editingInstancesAdded([{ exportAttempts: [], id: "instance-1", origin: "source-import", snapshot: createDefaultEditorSnapshot(firstSource, false), sourceAvailability: "available" }]));
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
    store.dispatch(editingInstancesAdded([{ exportAttempts: [], id: "instance-1", origin: "source-import", snapshot: createDefaultEditorSnapshot(firstSource, false), sourceAvailability: "available" }]));
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
});

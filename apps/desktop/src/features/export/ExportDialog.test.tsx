import { render } from "@testing-library/react";
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
import { createAppStore } from "@/app/store/store";
import { openOptimizedExportDialog } from "@/app/store/thunks/export-thunks";
import { firstSource, media } from "@/test/source-fixtures";

import { ExportDialog } from "./ExportDialog";

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
});

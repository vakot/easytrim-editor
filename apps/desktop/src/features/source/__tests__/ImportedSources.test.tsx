import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prepareImportedSourcePreview = vi.hoisted(() =>
  vi.fn(async (sourcePath: string) => ({
    kind: "source" as const,
    mediaToken: 1,
    url: `http://easytrim-media.localhost/${encodeURIComponent(sourcePath)}?variant=source`,
  })),
);

vi.mock("@/lib/tauri/media", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tauri/media")>()),
  prepareImportedSourcePreview,
}));

beforeEach(() => {
  prepareImportedSourcePreview.mockClear();
});

import { TooltipProvider } from "@/components/ui/tooltip";

import { createDefaultEditorSnapshot } from "@/app/store/integration/editor-snapshot";
import {
  activeEditingInstanceChanged,
  editingInstancesAdded,
} from "@/app/store/slices/editing-instances-slice";
import { importedPreviewReady } from "@/app/store/slices/preview-slice";
import { createAppStore } from "@/app/store/store";
import type { EditingInstance } from "@/domain/editing-instance";

import { ImportedSources } from "../ImportedSources";

function instance(id: string, displayName: string): EditingInstance {
  return {
    exportAttempts: [],
    id,
    origin: "source-import",
    snapshot: createDefaultEditorSnapshot(
      { displayName, sourcePath: `C:/Media/${displayName}` },
      false,
    ),
    sourceAvailability: "available",
  };
}

describe("ImportedSources", () => {
  it("renders imported source cards and filters by filename or path", () => {
    const store = createAppStore();
    store.dispatch(
      editingInstancesAdded([
        instance("first", "holiday.mp4"),
        instance("second", "screen-recording.mp4"),
      ]),
    );
    store.dispatch(activeEditingInstanceChanged("first"));

    render(
      <Provider store={store}>
        <TooltipProvider>
          <ImportedSources />
        </TooltipProvider>
      </Provider>,
    );

    expect(screen.getByText("holiday.mp4")).toBeInTheDocument();
    expect(screen.getByText("C:/Media/screen-recording.mp4")).toBeInTheDocument();
    expect(document.querySelector('[data-slot="imported-sources-grid"]')).toBeInTheDocument();

    expect(document.querySelector('[data-source-id="first"]')).toHaveAttribute(
      "data-variant",
      "default",
    );

    fireEvent.change(screen.getByRole("searchbox", { name: "Search" }), {
      target: { value: "recording" },
    });

    expect(screen.queryByText("holiday.mp4")).not.toBeInTheDocument();
    expect(screen.getByText("screen-recording.mp4")).toBeInTheDocument();
  });

  it("restores the source explorer empty view when no sources are open", () => {
    render(
      <Provider store={createAppStore()}>
        <TooltipProvider>
          <ImportedSources />
        </TooltipProvider>
      </Provider>,
    );

    expect(screen.getByText("Choose a single video file to start editing.")).toBeInTheDocument();
    expect(screen.getByText("Drag and drop videos here")).toBeInTheDocument();
    expect(screen.getByText("MP4 · MOV · MKV · WebM · AVI")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Open File/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Open Folder/ })).toBeInTheDocument();
  });

  it("uses the asynchronously retained preview for each source", () => {
    const store = createAppStore();
    store.dispatch(editingInstancesAdded([instance("first", "holiday.mp4")]));
    store.dispatch(
      importedPreviewReady({
        instanceId: "first",
        preview: {
          kind: "source",
          mediaToken: 1,
          url: "http://easytrim-media.localhost/9223372036854775809?variant=source",
        },
      }),
    );

    render(
      <Provider store={store}>
        <TooltipProvider>
          <ImportedSources />
        </TooltipProvider>
      </Provider>,
    );

    expect(screen.getByLabelText("holiday.mp4 preview")).toHaveAttribute(
      "src",
      "http://easytrim-media.localhost/9223372036854775809?variant=source",
    );
  });

  it("requests previews for every imported source", async () => {
    const store = createAppStore();
    store.dispatch(
      editingInstancesAdded([
        instance("first", "holiday.mp4"),
        instance("second", "screen-recording.mp4"),
      ]),
    );

    render(
      <Provider store={store}>
        <TooltipProvider>
          <ImportedSources />
        </TooltipProvider>
      </Provider>,
    );

    await waitFor(() => expect(prepareImportedSourcePreview).toHaveBeenCalledTimes(2));
    expect(screen.getByLabelText("holiday.mp4 preview")).toBeInTheDocument();
    expect(screen.getByLabelText("screen-recording.mp4 preview")).toBeInTheDocument();
  });
});

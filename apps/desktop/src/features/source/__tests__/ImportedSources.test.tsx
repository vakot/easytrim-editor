import { fireEvent, render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { describe, expect, it } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";

import { createDefaultEditorSnapshot } from "@/app/store/integration/editor-snapshot";
import {
  activeEditingInstanceChanged,
  editingInstancesAdded,
} from "@/app/store/slices/editing-instances-slice";
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

    expect(screen.getByRole("complementary", { name: "Imported sources" })).toBeInTheDocument();
    expect(screen.getByText("holiday.mp4")).toBeInTheDocument();
    expect(screen.getByText("C:/Media/screen-recording.mp4")).toBeInTheDocument();
    expect(document.querySelector('[data-slot="imported-sources-grid"]')).toBeInTheDocument();

    fireEvent.change(screen.getByRole("searchbox", { name: "Search" }), {
      target: { value: "recording" },
    });

    expect(screen.queryByText("holiday.mp4")).not.toBeInTheDocument();
    expect(screen.getByText("screen-recording.mp4")).toBeInTheDocument();
  });

  it("shows the import actions when no sources are open", () => {
    render(
      <Provider store={createAppStore()}>
        <TooltipProvider>
          <ImportedSources />
        </TooltipProvider>
      </Provider>,
    );

    expect(screen.getByText("No imported sources yet.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open File" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Folder" })).toBeInTheDocument();
  });
});

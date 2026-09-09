import { fireEvent, render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { describe, expect, it } from "vitest";

import { createDefaultEditorSnapshot } from "@/app/store/integration/editor-snapshot";
import {
  activeEditingInstanceChanged,
  editingInstancesAdded,
} from "@/app/store/slices/editing-instances-slice";
import { createAppStore } from "@/app/store/store";
import type { EditingInstance } from "@/domain/editing-instance";

import { SourceBreadcrumb } from "../SourceBreadcrumb";

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

describe("SourceBreadcrumb", () => {
  it("searches and highlights sources in a breadcrumb popover", () => {
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
        <SourceBreadcrumb />
      </Provider>,
    );

    fireEvent.click(screen.getByTitle("C:/Media"));
    fireEvent.change(screen.getByRole("searchbox", { name: "Search" }), {
      target: { value: "record" },
    });

    expect(screen.queryByRole("button", { name: "holiday.mp4" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "screen-recording.mp4" })).toBeInTheDocument();
    expect(screen.getByText("record").tagName).toBe("MARK");
  });
});

import { render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { describe, expect, it } from "vitest";

import { createDefaultEditorSnapshot } from "@/app/store/integration/editor-snapshot";
import {
  activeEditingInstanceChanged,
  editingInstancesAdded,
} from "@/app/store/slices/editing-instances-slice";
import { createAppStore } from "@/app/store/store";
import type { EditingInstance } from "@/domain/editing-instance";

import { SourceTabs } from "../SourceTabs";

function createSource(id: string, displayName: string): EditingInstance {
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

describe("SourceTabs", () => {
  it("shows every imported source before it has been opened", () => {
    const store = createAppStore();
    const sources = [
      createSource("first", "holiday.mp4"),
      createSource("second", "screen-recording.mp4"),
    ];

    store.dispatch(editingInstancesAdded(sources));
    store.dispatch(activeEditingInstanceChanged("first"));

    render(
      <Provider store={store}>
        <SourceTabs />
      </Provider>,
    );

    expect(screen.getByRole("tab", { name: "holiday.mp4" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "screen-recording.mp4" })).toBeInTheDocument();
  });
});

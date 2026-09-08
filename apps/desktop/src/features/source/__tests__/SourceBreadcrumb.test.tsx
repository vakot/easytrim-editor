import { fireEvent, render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { describe, expect, it } from "vitest";

import { createDefaultEditorSnapshot } from "@/app/store/integration/editor-snapshot";
import {
  activeEditingInstanceChanged,
  editingInstancesAdded,
} from "@/app/store/slices/editing-instances-slice";
import { createAppStore } from "@/app/store/store";
import { firstSource } from "@/test/source.fixtures";

import { SourceBreadcrumb } from "../SourceBreadcrumb";

describe("SourceBreadcrumb", () => {
  it("places plain rotation controls in the breadcrumb row while crop is open", () => {
    const store = createAppStore();
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

    const { container } = render(
      <Provider store={store}>
        <SourceBreadcrumb cropToolOpen />
      </Provider>,
    );

    const controls = container.querySelector("[data-crop-rotation-controls]");
    expect(controls).toHaveClass("gap-1");
    expect(controls).not.toHaveClass("bg-background/85");
    expect(controls?.parentElement).toHaveClass("justify-between");

    fireEvent.click(screen.getByRole("button", { name: "Rotate clockwise" }));
    expect(store.getState().crop.rotationDegrees).toBe(90);
  });
});

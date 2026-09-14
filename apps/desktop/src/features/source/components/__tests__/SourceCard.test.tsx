import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

import { SourceCard } from "../SourceCard";

function createSource(
  sourceAvailability: EditingInstance["sourceAvailability"] = "available",
): EditingInstance {
  return {
    exportAttempts: [],
    id: "source-1",
    origin: "source-import",
    snapshot: createDefaultEditorSnapshot(
      { displayName: "holiday.mp4", sourcePath: "C:/Media/holiday.mp4" },
      false,
    ),
    sourceAvailability,
  };
}

function renderSourceCard(source = createSource()) {
  const store = createAppStore();
  store.dispatch(editingInstancesAdded([source]));
  store.dispatch(activeEditingInstanceChanged(source.id));

  return render(
    <Provider store={store}>
      <TooltipProvider>
        <SourceCard source={source} />
      </TooltipProvider>
    </Provider>,
  );
}

describe("SourceCard", () => {
  it("derives the title, path, and default variant from its ready source", () => {
    renderSourceCard();

    const card = document.querySelector('[data-slot="card"]');
    expect(card).toHaveAttribute("data-variant", "default");
    expect(screen.getByText("holiday.mp4")).toBeInTheDocument();
    expect(screen.getByText("C:/Media/holiday.mp4")).toBeInTheDocument();
    expect(screen.queryByText("Ready")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Source actions: holiday.mp4")).toBeInTheDocument();
  });

  it("derives the deleted state and restore action from its source", async () => {
    renderSourceCard(createSource("deleted"));

    expect(document.querySelector('[data-slot="card"]')).toHaveAttribute(
      "data-variant",
      "destructive",
    );
    expect(screen.getByText("Deleted")).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Source actions: holiday.mp4" }));

    expect(screen.getByRole("menuitem", { name: "Restore source" })).toBeInTheDocument();
  });

  it("owns its delete dialog behavior", async () => {
    renderSourceCard();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Source actions: holiday.mp4" }));
    await user.click(screen.getByRole("menuitem", { name: "Delete source file" }));

    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByText("Delete source file?")).toBeInTheDocument();
  });
});

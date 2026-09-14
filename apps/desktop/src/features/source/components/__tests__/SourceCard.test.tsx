import { fireEvent, render, screen } from "@testing-library/react";
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

    const card = screen.getByRole("checkbox", { name: "holiday.mp4" });
    expect(card).toHaveAttribute("data-variant", "default");
    expect(screen.getByText("holiday.mp4")).toBeInTheDocument();
    expect(screen.getByText("C:/Media/holiday.mp4")).toBeInTheDocument();
    expect(screen.queryByText("Ready")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByLabelText("Source actions: holiday.mp4")).toBeInTheDocument();
  });

  it("derives the deleted state and restore action from its source", async () => {
    renderSourceCard(createSource("deleted"));

    expect(screen.getByRole("checkbox", { name: "holiday.mp4" })).toHaveAttribute(
      "data-variant",
      "destructive",
    );
    expect(screen.getByText("Deleted")).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Source actions: holiday.mp4" }));

    expect(screen.getByRole("menuitem", { name: "Restore" })).toBeInTheDocument();
  });

  it("owns its delete dialog behavior", async () => {
    renderSourceCard();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Source actions: holiday.mp4" }));
    expect(
      screen.getByRole("menuitem", { name: /Reveal in (File Manager|File Explorer|Finder)/ }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("menuitem", { name: "Delete File" }));

    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByText("Delete source file?")).toBeInTheDocument();
  });

  it("shows ordered context actions and reveals the selected file", async () => {
    renderSourceCard();

    fireEvent.contextMenu(screen.getByRole("checkbox", { name: "holiday.mp4" }));

    const menuItems = screen.getAllByRole("menuitem");
    expect(menuItems[0]).toHaveTextContent(/Reveal in (File Manager|File Explorer|Finder)/);
    expect(menuItems[1]).toHaveTextContent("Close File (1)");
    expect(menuItems[2]).toHaveTextContent("Delete File (1)");

    const user = userEvent.setup();
    await user.click(menuItems[0]!);
    expect(screen.getByRole("menuitem", { name: "holiday.mp4" })).toBeInTheDocument();
  });
});

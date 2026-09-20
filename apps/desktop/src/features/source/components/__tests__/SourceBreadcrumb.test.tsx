import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { describe, expect, it, vi } from "vitest";

const openFileLocation = vi.hoisted(() => vi.fn());

vi.mock("@/lib/tauri/media", () => ({ openFileLocation }));

import { TooltipProvider } from "@/components/ui/tooltip";

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
  it("opens source locations and shows the source details tooltip", async () => {
    const user = userEvent.setup();
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
        <TooltipProvider delayDuration={0}>
          <SourceBreadcrumb />
        </TooltipProvider>
      </Provider>,
    );

    await user.click(screen.getByRole("button", { name: "Media" }));
    await user.click(screen.getByRole("button", { name: "holiday.mp4" }));

    expect(openFileLocation).toHaveBeenNthCalledWith(1, "C:/Media");
    expect(openFileLocation).toHaveBeenNthCalledWith(2, "C:/Media/holiday.mp4");

    const detailsTrigger = screen.getByRole("button", { name: "Technical details" });
    await user.hover(detailsTrigger);

    expect(await screen.findByRole("tooltip")).toHaveTextContent("Technical details");
  });
});

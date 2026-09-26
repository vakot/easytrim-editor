import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { describe, expect, it } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";

import { createDefaultEditorSnapshot } from "@/app/store/integration/editor-snapshot";
import {
  activeEditingInstanceChanged,
  editingInstancesAdded,
  selectActiveInstanceId,
} from "@/app/store/slices/editing-instances-slice";
import { createAppStore } from "@/app/store/store";
import type { EditingInstance } from "@/domain/editing-instance";

import { SourceNavigation } from "../SourceNavigation";

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

describe("SourceNavigation", () => {
  it("navigates between sources and exposes translated boundary labels", async () => {
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
          <SourceNavigation />
        </TooltipProvider>
      </Provider>,
    );

    const previousButton = screen.getByRole("button", { name: "Previous source" });
    const nextButton = screen.getByRole("button", { name: "Next source" });
    expect(previousButton).toBeDisabled();
    expect(nextButton).not.toBeDisabled();

    await user.hover(nextButton);
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Next source");

    await user.click(nextButton);
    expect(selectActiveInstanceId(store.getState())).toBe("second");
    expect(previousButton).not.toBeDisabled();
    expect(nextButton).toBeDisabled();
  });
});

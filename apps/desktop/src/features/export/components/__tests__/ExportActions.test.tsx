import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { describe, expect, it } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";

import { createDefaultEditorSnapshot } from "@/app/store/integration/editor-snapshot";
import {
  editingInstanceExportAttemptQueued,
  editingInstancesAdded,
} from "@/app/store/slices/editing-instances-slice";
import { createAppStore } from "@/app/store/store";
import { createExportAttempt } from "@/domain/editing-instance";
import { firstSource } from "@/test/source.fixtures";

import { ExportActions } from "../ExportActions";

describe("ExportActions", () => {
  it("keeps both export routes visible while disabling them without a ready source", () => {
    render(
      <Provider store={createAppStore()}>
        <TooltipProvider>
          <ExportActions />
        </TooltipProvider>
      </Provider>,
    );

    expect(screen.getByRole("toolbar", { name: "Export actions" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Fast Export" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Optimized Export" })).toBeDisabled();
  });

  it("keeps the dialog footer stable and disables Start queue without queued work", async () => {
    const user = userEvent.setup();
    render(
      <Provider store={createAppStore()}>
        <TooltipProvider>
          <ExportActions />
        </TooltipProvider>
      </Provider>,
    );

    await user.click(screen.getByRole("button", { name: /Export Queue$/ }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start queue" })).toBeDisabled();
    expect(
      within(screen.getByRole("dialog")).getAllByRole("button", { name: "Close" }),
    ).toHaveLength(2);
    expect(screen.getByRole("dialog")).toHaveClass("max-h-[min(80dvh,48rem)]");
  });

  it("enables Start queue when queued work exists", async () => {
    const user = userEvent.setup();
    const store = createAppStore();
    const snapshot = createDefaultEditorSnapshot(firstSource, false);
    const attempt = createExportAttempt({
      capturedAt: 1,
      id: "attempt-1",
      output: {
        displayName: "trimmed.mp4",
        displayPath: "C:/Exports/trimmed.mp4",
        outputId: "output-1",
      },
      request: {
        audioTracks: [],
        mergeAudio: false,
        rotationDegrees: 0,
        sourcePath: firstSource.sourcePath,
        trim: { endMicros: 1_000_000, startMicros: 0 },
      },
      route: "fast",
      snapshot,
    });

    store.dispatch(
      editingInstancesAdded([
        {
          exportAttempts: [],
          id: "source-1",
          origin: "source-import",
          snapshot,
          sourceAvailability: "available",
        },
      ]),
    );
    render(
      <Provider store={store}>
        <TooltipProvider>
          <ExportActions />
        </TooltipProvider>
      </Provider>,
    );

    const queueButton = screen.getByRole("button", { name: /Export Queue$/ });
    queueButton.focus();
    act(() => {
      store.dispatch(editingInstanceExportAttemptQueued({ attempt, id: "source-1" }));
    });

    expect(document.activeElement).toBe(queueButton);
    expect(queueButton).toHaveClass("max-2xl:size-auto");
    expect(queueButton).toHaveClass("max-2xl:px-2");
    expect(
      within(queueButton).getByText((_, element) => element?.textContent === "0/1").parentElement,
    ).toBe(queueButton);

    await user.click(screen.getByRole("button", { name: /Export Queue$/ }));

    expect(screen.getByRole("button", { name: "Start queue" })).not.toBeDisabled();
  });
});

import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Profiler } from "react";
import { Provider } from "react-redux";
import { describe, expect, it } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";

import { sourceReady, sourceSelected } from "@/app/store/actions/source-actions";
import { createDefaultEditorSnapshot } from "@/app/store/integration/editor-snapshot";
import {
  activeEditingInstanceChanged,
  editingInstancesAdded,
} from "@/app/store/slices/editing-instances-slice";
import { createAppStore } from "@/app/store/store";
import { createExportAttempt, type EditingInstance } from "@/domain/editing-instance";
import { SourceDeleteProvider } from "@/features/source";
import { media } from "@/test/source.fixtures";

import {
  SourceCard,
  SourceCardActions,
  SourceCardDescription,
  SourceCardMetadata,
  SourceCardStatusBadge,
  SourceCardTitle,
} from "../";

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
      <SourceDeleteProvider>
        <TooltipProvider>
          <SourceCard source={source}>
            <SourceCardTitle />
            <SourceCardDescription />
            <SourceCardMetadata />
            <SourceCardStatusBadge />
            <SourceCardActions>
              <button aria-label="Source actions: holiday.mp4" type="button" />
            </SourceCardActions>
          </SourceCard>
        </TooltipProvider>
      </SourceDeleteProvider>
    </Provider>,
  );
}

describe("SourceCard", () => {
  it("derives the title, path, and active variant from its ready source", () => {
    renderSourceCard();

    const card = screen.getByRole("checkbox", { name: "holiday.mp4" });
    expect(card).toHaveAttribute("data-variant", "active");
    expect(screen.getByText("holiday.mp4")).toBeInTheDocument();
    expect(screen.getByText("C:/Media/holiday.mp4")).toBeInTheDocument();
    expect(screen.queryByText("Ready")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Source actions: holiday.mp4")).toBeInTheDocument();
  });

  it("derives the deleted state and restore action from its source", async () => {
    renderSourceCard(createSource("deleted"));

    expect(screen.getByRole("checkbox", { name: "holiday.mp4" })).toHaveAttribute(
      "data-variant",
      "active",
    );
    expect(screen.getByText("Deleted")).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Source actions: holiday.mp4" }));

    expect(screen.getByRole("menuitem", { name: "Restore" })).toBeInTheDocument();
  });

  it("updates only the previously active and active cards on selection and status changes", () => {
    const store = createAppStore();
    const sources = ["one", "two", "other"].map((id) => ({
      ...createSource(),
      id,
      snapshot: createDefaultEditorSnapshot(
        { displayName: `${id}.mp4`, sourcePath: `C:/Media/${id}.mp4` },
        false,
      ),
    }));

    store.dispatch(editingInstancesAdded(sources));
    store.dispatch(activeEditingInstanceChanged("one"));
    const renders = new Map<string, number>();

    render(
      <Provider store={store}>
        {sources.map((source) => (
          <Profiler
            id={source.id}
            key={source.id}
            onRender={(id) => renders.set(id, (renders.get(id) ?? 0) + 1)}
          >
            <SourceCard source={source}>
              <SourceCardStatusBadge />
            </SourceCard>
          </Profiler>
        ))}
      </Provider>,
    );

    const initial = new Map(renders);
    act(() => store.dispatch(activeEditingInstanceChanged("two")));
    expect(renders.get("one")).toBe((initial.get("one") ?? 0) + 1);
    expect(renders.get("two")).toBe((initial.get("two") ?? 0) + 1);
    expect(renders.get("other")).toBe(initial.get("other"));

    const afterSelection = new Map(renders);
    act(() =>
      store.dispatch(sourceSelected({ loadToken: 1, source: sources[1]!.snapshot.source })),
    );
    expect(renders.get("one")).toBe(afterSelection.get("one"));
    expect(renders.get("two")).toBe((afterSelection.get("two") ?? 0) + 1);
    expect(renders.get("other")).toBe(afterSelection.get("other"));

    const afterLoading = new Map(renders);
    act(() =>
      store.dispatch(
        sourceReady({ loadToken: 1, media: media(sources[1]!.snapshot.source.sourcePath) }),
      ),
    );
    expect(renders.get("one")).toBe(afterLoading.get("one"));
    expect(renders.get("two")).toBe((afterLoading.get("two") ?? 0) + 1);
    expect(renders.get("other")).toBe(afterLoading.get("other"));
  });

  it("does not expose export progress on the original source card", () => {
    const source = createSource();
    source.exportAttempts.push(
      createExportAttempt({
        capturedAt: 1,
        id: "attempt-1",
        output: {
          displayName: "export.mp4",
          displayPath: "C:/Media/export.mp4",
          outputId: "output-1",
        },
        request: {
          audioTracks: [],
          mergeAudio: false,
          rotationDegrees: 0,
          sourcePath: source.snapshot.source.sourcePath,
          trim: { endMicros: 1_000_000, startMicros: 0 },
        },
        route: "fast",
        snapshot: source.snapshot,
      }),
    );
    renderSourceCard(source);

    expect(screen.getByRole("checkbox", { name: "holiday.mp4" })).toHaveAttribute(
      "data-variant",
      "active",
    );
    expect(screen.queryByText("Queued")).not.toBeInTheDocument();
    expect(screen.queryByText("Rendering…")).not.toBeInTheDocument();
    expect(screen.queryByText("Completed")).not.toBeInTheDocument();
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

  it("shows individual context actions for a non-selected card", () => {
    renderSourceCard();

    fireEvent.contextMenu(screen.getByRole("checkbox", { name: "holiday.mp4" }));

    const menuItems = screen.getAllByRole("menuitem");
    expect(menuItems[0]).toHaveTextContent(/Reveal in (File Manager|File Explorer|Finder)/);
    expect(menuItems[1]).toHaveTextContent("Close File");
    expect(menuItems[2]).toHaveTextContent("Delete File");

    expect(screen.queryByRole("menuitem", { name: "holiday.mp4" })).not.toBeInTheDocument();
  });
});

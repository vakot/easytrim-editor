import { render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { describe, expect, it } from "vitest";

import { createDefaultEditorSnapshot } from "@/app/store/integration/editor-snapshot";
import { editingInstancesAdded } from "@/app/store/slices/editing-instances-slice";
import { importedThumbnailReady } from "@/app/store/slices/preview-slice";
import { createAppStore } from "@/app/store/store";
import type { EditingInstance, EditingInstanceListEntry } from "@/domain/editing-instance";
import { media } from "@/test/source.fixtures";

import { SourceCardThumbnail } from "../components/SourceCardThumbnail";
import { SourceCard } from "../SourceCard";

const source: EditingInstance = {
  exportAttempts: [],
  id: "thumbnail-source",
  origin: "source-import",
  snapshot: createDefaultEditorSnapshot(
    { displayName: "clip.mp4", sourcePath: "C:/Media/clip.mp4" },
    false,
  ),
  sourceAvailability: "available",
};

describe("SourceCardThumbnail", () => {
  function renderThumbnail(source: EditingInstance | EditingInstanceListEntry) {
    const store = createAppStore();
    if ("snapshot" in source) store.dispatch(editingInstancesAdded([source]));

    return render(
      <Provider store={store}>
        <SourceCard source={source}>
          <SourceCardThumbnail />
        </SourceCard>
      </Provider>,
    );
  }

  it("loads thumbnail images asynchronously at low priority", () => {
    const store = createAppStore();
    store.dispatch(editingInstancesAdded([source]));
    store.dispatch(
      importedThumbnailReady({
        instanceId: source.id,
        thumbnail: { mediaToken: 1, url: "media://thumbnail" },
      }),
    );

    render(
      <Provider store={store}>
        <SourceCard source={source}>
          <SourceCardThumbnail />
        </SourceCard>
      </Provider>,
    );

    const image = screen.getByRole("img", { name: "Thumbnail for clip.mp4" });
    expect(image).toHaveAttribute("decoding", "async");
    expect(image).toHaveAttribute("loading", "lazy");
    expect(image).toHaveAttribute("fetchpriority", "low");
  });

  it("fills the indicator for a saved full-source trim", () => {
    const { container } = renderThumbnail(source);

    expect(container.querySelector(".bg-primary")).toHaveStyle({ left: "0%", width: "100%" });
  });

  it("positions the indicator from the saved trim relative to source duration", () => {
    const trimmedSource: EditingInstance = {
      ...source,
      media: media(source.snapshot.source.sourcePath),
      snapshot: {
        ...source.snapshot,
        trim: { endMicros: 3_000_000, startMicros: 1_000_000 },
      },
    };

    const { container } = renderThumbnail(trimmedSource);

    expect(container.querySelector(".bg-primary")).toHaveStyle({ left: "20%", width: "40%" });
  });

  it("leaves the indicator empty when the list snapshot has no trim state", () => {
    const sourceWithoutTrim: EditingInstanceListEntry = {
      displayName: "clip.mp4",
      durationMicros: 5_000_000,
      id: "thumbnail-source",
      sourceAvailability: "available",
      sourcePath: "C:/Media/clip.mp4",
    };

    const { container } = renderThumbnail(sourceWithoutTrim);

    expect(container.querySelector(".bg-primary")).toHaveStyle({ left: "0%", width: "0%" });
  });
});

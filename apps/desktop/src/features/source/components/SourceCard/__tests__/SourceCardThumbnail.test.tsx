import { render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { describe, expect, it } from "vitest";

import { createDefaultEditorSnapshot } from "@/app/store/integration/editor-snapshot";
import { editingInstancesAdded } from "@/app/store/slices/editing-instances-slice";
import { importedThumbnailReady } from "@/app/store/slices/preview-slice";
import { createAppStore } from "@/app/store/store";
import type { EditingInstance } from "@/domain/editing-instance";

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

    const image = screen.getByRole("img", { name: "clip.mp4 thumbnail" });
    expect(image).toHaveAttribute("decoding", "async");
    expect(image).toHaveAttribute("loading", "lazy");
    expect(image).toHaveAttribute("fetchpriority", "low");
  });
});

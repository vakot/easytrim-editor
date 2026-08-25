import { describe, expect, it } from "vitest";

import { sourceSelected } from "@/app/store/actions/source-actions";
import {
  initialPreviewState,
  previewFailed,
  previewReady,
  previewReducer,
  selectPreview,
} from "../preview-slice";
import { firstSource, secondSource } from "./test-fixtures";

describe("preview slice", () => {
  it("rejects a preview completed for a replaced source", () => {
    const loadingFirst = previewReducer(
      initialPreviewState,
      sourceSelected({ source: firstSource }),
    );
    const loadingSecond = previewReducer(loadingFirst, sourceSelected({ source: secondSource }));
    const stale = previewReducer(
      loadingSecond,
      previewReady({
        sourceId: firstSource.sourceId,
        preview: { sourceId: firstSource.sourceId, kind: "source", url: "media://first" },
      }),
    );

    expect(stale).toBe(loadingSecond);
  });

  it("records proxy failure without changing source ownership", () => {
    const selected = previewReducer(initialPreviewState, sourceSelected({ source: firstSource }));
    const failed = previewReducer(
      selected,
      previewFailed({
        sourceId: firstSource.sourceId,
        error: { code: "preview_failed", message: "Preview failed." },
      }),
    );

    expect(selectPreview({ preview: failed } as never)).toEqual({
      status: "failed",
      error: { code: "preview_failed", message: "Preview failed." },
    });
  });
});

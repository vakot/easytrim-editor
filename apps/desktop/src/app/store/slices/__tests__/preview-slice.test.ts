import { describe, expect, it } from "vitest";

import { sourceSelected } from "@/app/store/actions/source-actions";
import { firstSource, secondSource } from "@/test/source.fixtures";

import {
  initialPreviewState,
  previewFailed,
  previewReducer,
  selectPreview,
} from "../preview-slice";

describe("preview slice", () => {
  it("starts the next source preview lifecycle when the source changes", () => {
    const loadingFirst = previewReducer(
      initialPreviewState,
      sourceSelected({ source: firstSource }),
    );

    const loadingSecond = previewReducer(loadingFirst, sourceSelected({ source: secondSource }));
    expect(loadingSecond).toEqual({ value: { status: "loading", kind: "source" } });
  });

  it("records proxy failure without changing source ownership", () => {
    const selected = previewReducer(initialPreviewState, sourceSelected({ source: firstSource }));
    const failed = previewReducer(
      selected,
      previewFailed({
        error: { code: "preview_failed", message: "Preview failed." },
      }),
    );

    expect(selectPreview({ preview: failed } as never)).toEqual({
      status: "failed",
      error: { code: "preview_failed", message: "Preview failed." },
    });
  });
});

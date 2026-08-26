import { describe, expect, it } from "vitest";

import { sourceSelected } from "@/app/store/actions/source-actions";
import {
  initialPreviewState,
  previewFailed,
  previewReducer,
  selectPreview,
} from "../preview-slice";
import { firstSource, secondSource } from "./test-fixtures";

describe("preview slice", () => {
  it("resets the preview when the source changes", () => {
    const loadingFirst = previewReducer(
      initialPreviewState,
      sourceSelected({ source: firstSource }),
    );
    const loadingSecond = previewReducer(loadingFirst, sourceSelected({ source: secondSource }));
    expect(loadingSecond).toEqual({ value: { status: "idle" } });
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

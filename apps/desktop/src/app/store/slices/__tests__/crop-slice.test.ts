import { describe, expect, it } from "vitest";

import { sourceCleared, sourceReady, sourceSelected } from "@/app/store/actions/source-actions";
import { firstSource, media } from "@/test/source.fixtures";

import { createAppStore } from "../../store";
import {
  cropChanged,
  cropReducer,
  initialCropState,
  selectCropApplied,
  selectCropResolution,
} from "../crop-slice";

describe("crop slice", () => {
  it("resets to FULL_CROP on source lifecycle events and derives applied state", () => {
    const selected = cropReducer(initialCropState, sourceSelected({ source: firstSource }));
    const changed = cropReducer(
      selected,
      cropChanged({
        crop: { x: 0.1, y: 0, width: 0.8, height: 1 },
        resolution: { width: 1536, height: 1080 },
      }),
    );
    const cleared = cropReducer(changed, sourceCleared());

    expect(selectCropApplied({ crop: changed } as never)).toBe(true);
    expect(cleared.value).toEqual({ x: 0, y: 0, width: 1, height: 1 });
  });

  it("derives crop resolution from the active crop and source media", () => {
    const store = createAppStore();
    store.dispatch(sourceSelected({ source: firstSource }));
    store.dispatch(sourceReady({ loadToken: 1, media: media(firstSource.sourcePath) }));

    expect(store.getState().crop).not.toHaveProperty("resolution");
    expect(store.getState().source.media?.video).toMatchObject({ width: 1920, height: 1080 });
    expect(selectCropResolution(store.getState())).toEqual({ width: 1920, height: 1080 });

    store.dispatch(
      cropChanged({
        crop: { x: 0.1, y: 0, width: 0.8, height: 1 },
        resolution: { width: 1536, height: 1080 },
      }),
    );
    expect(selectCropResolution(store.getState())).toEqual({ width: 1536, height: 1080 });
  });
});

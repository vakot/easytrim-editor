import { describe, expect, it } from "vitest";

import { sourceReady, sourceSelected } from "@/app/store/actions/source-actions";
import { trimChanged, trimReducer, initialTrimState, selectTrim } from "../trim-slice";
import { firstSource, media } from "./test-fixtures";

describe("trim slice", () => {
  it("initializes a full trim and rejects invalid or stale updates", () => {
    const loading = trimReducer(initialTrimState, sourceSelected({ source: firstSource }));
    const ready = trimReducer(
      loading,
      sourceReady({ loadToken: 1, media: media(firstSource.sourcePath) }),
    );
    const invalid = trimReducer(
      ready,
      trimChanged({
        trim: { startMicros: 2_000_000, endMicros: 2_000_000, sourceDurationMicros: 5_000_000 },
      }),
    );

    expect(selectTrim({ trim: ready } as never)).toEqual({
      startMicros: 0,
      endMicros: 5_000_000,
      sourceDurationMicros: 5_000_000,
    });
    expect(invalid).toBe(ready);
  });
});

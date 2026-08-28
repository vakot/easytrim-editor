import { describe, expect, it } from "vitest";

import { sourceFailed, sourceReady, sourceSelected } from "@/app/store/actions/source-actions";
import { firstSource, media, secondSource } from "@/test/source.fixtures";

import {
  initialSourceState,
  selectHasSource,
  selectSourceReady,
  selectSourceSelection,
  sourceReducer,
} from "../source-slice";

describe("source slice", () => {
  it("establishes the selected source and preserves the failed replacement", () => {
    const loading = sourceReducer(initialSourceState, sourceSelected({ source: firstSource }));
    const replacement = sourceReducer(loading, sourceSelected({ source: secondSource }));
    const failed = sourceReducer(
      replacement,
      sourceFailed({
        loadToken: 2,
        error: { code: "probe_failed", message: "Inspection failed." },
      }),
    );

    expect(failed.status).toBe("failed");
    expect(failed.source).toEqual(secondSource);
    expect(failed.media).toBeNull();
  });

  it("ignores metadata from a source that has already been replaced", () => {
    const loadingFirst = sourceReducer(initialSourceState, sourceSelected({ source: firstSource }));
    const loadingSecond = sourceReducer(loadingFirst, sourceSelected({ source: secondSource }));
    const staleCompletion = sourceReducer(
      loadingSecond,
      sourceReady({ loadToken: 1, media: media(firstSource.sourcePath) }),
    );

    expect(staleCompletion).toBe(loadingSecond);
  });

  it("exposes focused source selectors", () => {
    const loading = sourceReducer(initialSourceState, sourceSelected({ source: firstSource }));
    const ready = sourceReducer(
      loading,
      sourceReady({ loadToken: 1, media: media(firstSource.sourcePath) }),
    );

    const state = { source: ready } as never;

    expect(selectHasSource(state)).toBe(true);
    expect(selectSourceSelection(state)).toEqual(firstSource);
    expect(selectSourceReady(state)).toBe(true);
  });
});

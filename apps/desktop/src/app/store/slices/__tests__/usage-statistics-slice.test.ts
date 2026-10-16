import { describe, expect, it } from "vitest";

import {
  usageStatisticsLoaded,
  usageStatisticsLoadFailed,
  usageStatisticsReducer,
  usageStatisticsRequested,
} from "@/app/store/slices/usage-statistics-slice";
import { emptyUsageStatistics } from "@/test/usage-statistics.fixtures";

const loaded = { ...emptyUsageStatistics, optimizedExports: 3 };

function reduce(...actions: Parameters<typeof usageStatisticsReducer>[1][]) {
  return actions.reduce(
    usageStatisticsReducer,
    usageStatisticsReducer(undefined, { type: "init" }),
  );
}

describe("usage statistics slice", () => {
  it("stores the statistics of the latest request", () => {
    const state = reduce(
      usageStatisticsRequested({ requestId: "first" }),
      usageStatisticsLoaded({ requestId: "first", statistics: loaded }),
    );

    expect(state).toEqual({ requestId: null, statistics: loaded, status: "ready" });
  });

  it("ignores a response superseded by a newer request", () => {
    const state = reduce(
      usageStatisticsRequested({ requestId: "first" }),
      usageStatisticsRequested({ requestId: "second" }),
      usageStatisticsLoaded({ requestId: "first", statistics: loaded }),
    );

    expect(state).toEqual({ requestId: "second", statistics: null, status: "loading" });
  });

  it("keeps the last known statistics visible while refreshing and after a failed refresh", () => {
    const refreshing = reduce(
      usageStatisticsRequested({ requestId: "first" }),
      usageStatisticsLoaded({ requestId: "first", statistics: loaded }),
      usageStatisticsRequested({ requestId: "second" }),
    );

    expect(refreshing.status).toBe("ready");

    const failed = usageStatisticsReducer(
      refreshing,
      usageStatisticsLoadFailed({ requestId: "second" }),
    );

    expect(failed).toEqual({ requestId: null, statistics: loaded, status: "ready" });
  });

  it("reports a failure when nothing has loaded yet", () => {
    const state = reduce(
      usageStatisticsRequested({ requestId: "first" }),
      usageStatisticsLoadFailed({ requestId: "first" }),
    );

    expect(state.status).toBe("failed");
  });
});

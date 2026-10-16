import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getUsageStatistics: vi.fn() }));

vi.mock("@/lib/tauri/statistics", () => ({ getUsageStatistics: mocks.getUsageStatistics }));

import { editingInstanceExportCompleted } from "@/app/store/slices/editing-instances-slice";
import {
  selectUsageStatistics,
  selectUsageStatisticsStatus,
} from "@/app/store/slices/usage-statistics-slice";
import { createAppStore } from "@/app/store/store";
import { emptyUsageStatistics } from "@/test/usage-statistics.fixtures";

function createStore() {
  return createAppStore({
    getItem: async () => null,
    setItem: async () => undefined,
    removeItem: async () => undefined,
  });
}

function exportCompleted(attemptId: string) {
  return editingInstanceExportCompleted({
    attemptId,
    durationMs: 1_000,
    id: "instance-1",
    result: {
      displayName: "out.mp4",
      displayPath: "out.mp4",
      operationId: `operation-${attemptId}`,
    },
  });
}

beforeEach(() => {
  mocks.getUsageStatistics.mockReset();
});

describe("usage statistics refresh", () => {
  it("refreshes the statistics after an export completes", async () => {
    const statistics = { ...emptyUsageStatistics, losslessExports: 1 };
    mocks.getUsageStatistics.mockResolvedValue(statistics);
    const store = createStore();

    store.dispatch(exportCompleted("attempt-1"));

    await vi.waitFor(() => expect(selectUsageStatistics(store.getState())).toEqual(statistics));
    expect(mocks.getUsageStatistics).toHaveBeenCalledTimes(1);
  });

  it("only reads native totals, so duplicated completions cannot change the counts", async () => {
    const statistics = { ...emptyUsageStatistics, regularExports: 1 };
    mocks.getUsageStatistics.mockResolvedValue(statistics);
    const store = createStore();

    store.dispatch(exportCompleted("attempt-1"));
    store.dispatch(exportCompleted("attempt-1"));

    await vi.waitFor(() => expect(selectUsageStatisticsStatus(store.getState())).toBe("ready"));
    expect(selectUsageStatistics(store.getState())).toEqual(statistics);
  });
});

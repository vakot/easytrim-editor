import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import type { RootState } from "@/app/store/store";
import type { UsageStatistics } from "@/domain/usage-statistics";

type UsageStatisticsStatus = "failed" | "idle" | "loading" | "ready";

/** Runtime mirror of the natively persisted statistics; the native store is the source of truth. */
type UsageStatisticsState = {
  requestId: string | null;
  statistics: UsageStatistics | null;
  status: UsageStatisticsStatus;
};

const initialState: UsageStatisticsState = {
  requestId: null,
  statistics: null,
  status: "idle",
};

const usageStatisticsSlice = createSlice({
  name: "usageStatistics",
  initialState,
  reducers: {
    usageStatisticsRequested: (state, action: PayloadAction<{ requestId: string }>) => {
      state.requestId = action.payload.requestId;
      if (state.status !== "ready") state.status = "loading";
    },
    usageStatisticsLoaded: (
      state,
      action: PayloadAction<{ requestId: string; statistics: UsageStatistics }>,
    ) => {
      if (state.requestId !== action.payload.requestId) return;
      state.requestId = null;
      state.statistics = action.payload.statistics;
      state.status = "ready";
    },
    usageStatisticsLoadFailed: (state, action: PayloadAction<{ requestId: string }>) => {
      if (state.requestId !== action.payload.requestId) return;
      state.requestId = null;
      // Keep showing the last known totals when only a refresh failed.
      if (state.statistics === null) state.status = "failed";
    },
  },
});

const { usageStatisticsLoaded, usageStatisticsLoadFailed, usageStatisticsRequested } =
  usageStatisticsSlice.actions;

const usageStatisticsReducer = usageStatisticsSlice.reducer;

const selectUsageStatistics = (state: RootState): UsageStatistics | null =>
  state.usageStatistics.statistics;

const selectUsageStatisticsStatus = (state: RootState): UsageStatisticsStatus =>
  state.usageStatistics.status;

export {
  selectUsageStatistics,
  selectUsageStatisticsStatus,
  usageStatisticsLoaded,
  usageStatisticsLoadFailed,
  usageStatisticsReducer,
  usageStatisticsRequested,
};

import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import type { RootState } from "@/app/store/store";
import { type AchievementRecords, mergeAchievementRecords } from "@/domain/achievement-records";

type AchievementRecordsStatus = "failed" | "idle" | "loading" | "ready";

/** Runtime mirror of the natively persisted achievement records; the native store is the source of truth. */
type AchievementsState = {
  /**
   * Whether achievements already earned by the stored progress were unlocked for this session.
   * Until then unlocks are retroactive and must not be announced, and discoveries wait for it.
   */
  initialized: boolean;
  records: AchievementRecords | null;
  requestId: string | null;
  status: AchievementRecordsStatus;
};

const initialState: AchievementsState = {
  initialized: false,
  records: null,
  requestId: null,
  status: "idle",
};

const achievementsSlice = createSlice({
  name: "achievements",
  initialState,
  reducers: {
    achievementRecordsRequested: (state, action: PayloadAction<{ requestId: string }>) => {
      state.requestId = action.payload.requestId;
      if (state.status !== "ready") state.status = "loading";
    },
    achievementRecordsLoaded: (
      state,
      action: PayloadAction<{ records: AchievementRecords; requestId: string }>,
    ) => {
      // Native records only grow, so even a superseded snapshot is safe to merge.
      state.records = mergeAchievementRecords(state.records, action.payload.records);
      if (state.requestId !== action.payload.requestId) return;
      state.requestId = null;
      state.status = "ready";
    },
    achievementRecordsLoadFailed: (state, action: PayloadAction<{ requestId: string }>) => {
      if (state.requestId !== action.payload.requestId) return;
      state.requestId = null;
      if (state.records === null) state.status = "failed";
    },
    achievementRecordsUpdated: (state, action: PayloadAction<{ records: AchievementRecords }>) => {
      state.records = mergeAchievementRecords(state.records, action.payload.records);
    },
    achievementsInitialized: (state) => {
      state.initialized = true;
    },
  },
});

const {
  achievementRecordsLoaded,
  achievementRecordsLoadFailed,
  achievementRecordsRequested,
  achievementRecordsUpdated,
  achievementsInitialized,
} = achievementsSlice.actions;

const achievementsReducer = achievementsSlice.reducer;

const selectAchievementRecords = (state: RootState): AchievementRecords | null =>
  state.achievements.records;

const selectAchievementRecordsStatus = (state: RootState): AchievementRecordsStatus =>
  state.achievements.status;

const selectAchievementsInitialized = (state: RootState): boolean => state.achievements.initialized;

export {
  achievementRecordsLoaded,
  achievementRecordsLoadFailed,
  achievementRecordsRequested,
  achievementRecordsUpdated,
  achievementsInitialized,
  achievementsReducer,
  selectAchievementRecords,
  selectAchievementRecordsStatus,
  selectAchievementsInitialized,
};

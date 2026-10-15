import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import type { RootState } from "@/app/store/store";
import { DEFAULT_PLAYBACK_SPEED, type PlaybackSpeed } from "@/domain/playback-speed";

interface PlaybackControlsState {
  playbackSpeed: PlaybackSpeed;
}

const initialState: PlaybackControlsState = {
  playbackSpeed: DEFAULT_PLAYBACK_SPEED,
};

const playbackControlsSlice = createSlice({
  name: "playbackControls",
  initialState,
  reducers: {
    playbackSpeedChanged: (state, action: PayloadAction<PlaybackSpeed>) => {
      state.playbackSpeed = action.payload;
    },
  },
});

const { playbackSpeedChanged } = playbackControlsSlice.actions;
const playbackControlsReducer = playbackControlsSlice.reducer;

const selectPlaybackSpeed = (state: RootState): PlaybackSpeed =>
  state.playbackControls.playbackSpeed;

export { playbackControlsReducer, playbackSpeedChanged, selectPlaybackSpeed };

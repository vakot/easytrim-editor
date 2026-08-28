import { createSelector, createSlice, type PayloadAction } from "@reduxjs/toolkit";

import {
  sourceCleared,
  sourceFailed,
  sourceReady,
  sourceSelected,
} from "@/app/store/actions/source-actions";
import type {
  AppError,
  AudioPreviewDescriptor,
  MediaInfo,
  WaveformResult,
} from "@/lib/tauri/media";

import type { RootState } from "../store";

type WaveformState =
  | { status: "idle" }
  | { status: "loading"; jobId: string; width: number }
  | { status: "ready"; jobId: string; width: number; url: string }
  | { status: "failed"; jobId: string; width: number; error: AppError };

type AudioPreviewState =
  | { status: "idle"; previews: AudioPreviewDescriptor[] }
  | { status: "loading"; previews: AudioPreviewDescriptor[] }
  | { status: "ready"; previews: AudioPreviewDescriptor[] }
  | {
      status: "unavailable";
      previews: AudioPreviewDescriptor[];
      error: AppError;
    };

export interface AudioTrackState {
  streamIndex: number;
  enabled: boolean;
  volumePercent: number;
  waveform: WaveformState;
}

interface AudioState {
  tracks: AudioTrackState[];
  masterEnabled: boolean;
  masterVolumePercent: number;
  mergeAudio: boolean;
  previews: AudioPreviewState | null;
}

const DEFAULT_UNMUTE_VOLUME_PERCENT = 50;

export const initialAudioState: AudioState = {
  tracks: [],
  masterEnabled: true,
  masterVolumePercent: DEFAULT_UNMUTE_VOLUME_PERCENT,
  mergeAudio: false,
  previews: null,
};

const audioSlice = createSlice({
  name: "audio",
  initialState: initialAudioState,
  reducers: {
    audioPreviewsLoading: (state) => {
      state.previews = { status: "loading", previews: [] };
    },
    audioPreviewsReady: (state, action: PayloadAction<{ previews: AudioPreviewDescriptor[] }>) => {
      state.previews = {
        status: "ready",
        previews: action.payload.previews,
      };
    },
    audioPreviewsUnavailable: (state, action: PayloadAction<{ error: AppError }>) => {
      state.previews = {
        status: "unavailable",
        previews: [],
        error: action.payload.error,
      };
    },
    audioTrackToggled: (state, action: PayloadAction<{ streamIndex: number }>) => {
      const track = state.tracks.find(
        (candidate) => candidate.streamIndex === action.payload.streamIndex,
      );
      if (!track) return;
      track.enabled = !track.enabled;
      if (track.enabled && track.volumePercent <= 0)
        track.volumePercent = DEFAULT_UNMUTE_VOLUME_PERCENT;
    },
    audioTrackVolumeChanged: (
      state,
      action: PayloadAction<{ streamIndex: number; volumePercent: number }>,
    ) => {
      const track = state.tracks.find(
        (candidate) => candidate.streamIndex === action.payload.streamIndex,
      );
      if (!track) return;
      track.enabled = action.payload.volumePercent > 0;
      track.volumePercent = action.payload.volumePercent;
    },
    masterAudioToggled: (state) => {
      state.masterEnabled = !state.masterEnabled;
      if (state.masterEnabled && state.masterVolumePercent <= 0)
        state.masterVolumePercent = DEFAULT_UNMUTE_VOLUME_PERCENT;
    },
    masterVolumeChanged: (state, action: PayloadAction<{ volumePercent: number }>) => {
      state.masterEnabled = action.payload.volumePercent > 0;
      state.masterVolumePercent = action.payload.volumePercent;
    },
    audioMergeToggled: (state) => {
      state.mergeAudio = !state.mergeAudio;
    },
    waveformsLoading: (
      state,
      action: PayloadAction<{
        jobId: string;
        width: number;
        streamIndexes: number[];
      }>,
    ) => {
      state.tracks = updateWaveformTracks(state.tracks, action.payload.streamIndexes, () => ({
        status: "loading",
        jobId: action.payload.jobId,
        width: action.payload.width,
      }));
    },
    waveformReady: (state, action: PayloadAction<WaveformResult>) => {
      applyWaveformResult(state, action.payload);
    },
    waveformDisplayFailed: (state, action: PayloadAction<{ streamIndex: number }>) => {
      const track = state.tracks.find(
        (candidate) => candidate.streamIndex === action.payload.streamIndex,
      );
      if (track?.waveform.status === "ready") {
        track.waveform = {
          status: "failed",
          jobId: track.waveform.jobId,
          width: track.waveform.width,
          error: {
            code: "waveform_failed",
            message: "The waveform preview could not be displayed.",
          },
        };
      }
    },
    waveformsFailed: (
      state,
      action: PayloadAction<{
        jobId: string;
        width: number;
        streamIndexes: number[];
        error: AppError;
      }>,
    ) => {
      state.tracks = updateWaveformTracks(state.tracks, action.payload.streamIndexes, (track) =>
        track.waveform.status === "loading" && track.waveform.jobId === action.payload.jobId
          ? {
              status: "failed",
              jobId: action.payload.jobId,
              width: action.payload.width,
              error: action.payload.error,
            }
          : track.waveform,
      );
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(sourceSelected, (state, action) => {
        state.tracks = [];
        state.masterEnabled = true;
        state.masterVolumePercent = DEFAULT_UNMUTE_VOLUME_PERCENT;
        state.mergeAudio = action.payload.mergeAudio ?? false;
        state.previews = {
          status: "idle",
          previews: [],
        };
      })
      .addCase(sourceCleared, (state) => {
        state.tracks = [];
        state.masterEnabled = true;
        state.masterVolumePercent = DEFAULT_UNMUTE_VOLUME_PERCENT;
        state.mergeAudio = false;
        state.previews = null;
      })
      .addCase(sourceReady, (state, action) => {
        state.tracks = createAudioTracks(action.payload.media);
      })
      .addCase(sourceFailed, (state) => {
        state.tracks = [];
        state.masterEnabled = true;
        state.masterVolumePercent = DEFAULT_UNMUTE_VOLUME_PERCENT;
        state.mergeAudio = false;
        state.previews = null;
      });
  },
});

function createAudioTracks(media: MediaInfo): AudioTrackState[] {
  return media.audioStreams.map((stream) => ({
    streamIndex: stream.streamIndex,
    enabled: true,
    volumePercent: DEFAULT_UNMUTE_VOLUME_PERCENT,
    waveform: { status: "idle" },
  }));
}

function applyWaveformResult(state: AudioState, result: WaveformResult) {
  const track = state.tracks.find((candidate) => candidate.streamIndex === result.streamIndex);
  if (!track || track.waveform.status !== "loading" || track.waveform.jobId !== result.jobId)
    return;
  if (
    result.status === "ready" &&
    result.hasSignal === false &&
    track.enabled &&
    track.volumePercent === DEFAULT_UNMUTE_VOLUME_PERCENT
  ) {
    track.enabled = false;
    track.volumePercent = 0;
  }
  track.waveform =
    result.status === "ready"
      ? { status: "ready", jobId: result.jobId, width: result.width, url: result.url }
      : { status: "failed", jobId: result.jobId, width: result.width, error: result.error };
}

function updateWaveformTracks(
  tracks: AudioTrackState[],
  streamIndexes: number[],
  update: (track: AudioTrackState) => WaveformState,
): AudioTrackState[] {
  const selected = new Set(streamIndexes);
  return tracks.map((track) =>
    selected.has(track.streamIndex) ? { ...track, waveform: update(track) } : track,
  );
}

export const {
  audioPreviewsLoading,
  audioPreviewsReady,
  audioPreviewsUnavailable,
  audioTrackToggled,
  audioTrackVolumeChanged,
  masterAudioToggled,
  masterVolumeChanged,
  audioMergeToggled,
  waveformsLoading,
  waveformReady,
  waveformDisplayFailed,
  waveformsFailed,
} = audioSlice.actions;

export const audioReducer = audioSlice.reducer;

const EMPTY_AUDIO_TRACKS: AudioTrackState[] = [];

export const selectAudioTracks = (state: RootState): AudioTrackState[] =>
  state.audio.tracks.length > 0 ? state.audio.tracks : EMPTY_AUDIO_TRACKS;
export const selectMasterAudio = createSelector([(state: RootState) => state.audio], (audio) => ({
  enabled: audio.masterEnabled,
  volumePercent: audio.masterVolumePercent,
}));
export const selectMergeAudio = (state: RootState): boolean => state.audio.mergeAudio;
export const selectAudioPreviews = (state: RootState): AudioPreviewState | null =>
  state.audio.previews;

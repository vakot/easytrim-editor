import { createSelector, createSlice, type PayloadAction } from "@reduxjs/toolkit";

import { importQueueItemActivated } from "@/app/store/actions/imported-queue-actions";
import { sourceCleared, sourceReady, sourceSelected } from "@/app/store/actions/source-actions";
import type { EditorSnapshot } from "@/domain/editor-snapshot";
import type {
  AppError,
  AudioPreviewDescriptor,
  MediaInfo,
  WaveformResult,
} from "@/lib/tauri/media.types";

import type { RootState } from "../store";

type WaveformState =
  | { status: "idle" }
  | { jobId: string; status: "loading"; width: number }
  | { jobId: string; status: "ready"; url: string; width: number }
  | { error: AppError; jobId: string; status: "failed"; width: number };

type AudioPreviewState =
  | { previews: AudioPreviewDescriptor[]; status: "idle" }
  | { previews: AudioPreviewDescriptor[]; status: "loading" }
  | { previews: AudioPreviewDescriptor[]; status: "ready" }
  | {
      error: AppError;
      previews: AudioPreviewDescriptor[];
      status: "unavailable";
    };

export interface AudioTrackState {
  enabled: boolean;
  streamIndex: number;
  volumePercent: number;
  waveform: WaveformState;
}

interface AudioState {
  masterEnabled: boolean;
  masterVolumePercent: number;
  mergeAudio: boolean;
  previews: AudioPreviewState | null;
  tracks: AudioTrackState[];
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
        streamIndexes: number[];
        width: number;
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
        error: AppError;
        jobId: string;
        streamIndexes: number[];
        width: number;
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
      .addCase(importQueueItemActivated, (state, action) => {
        const { media, snapshot } = action.payload;
        state.tracks = media ? createAudioTracks(media, snapshot) : [];
        state.masterEnabled = snapshot.audio.master.enabled;
        state.masterVolumePercent = snapshot.audio.master.volumePercent;
        state.mergeAudio = snapshot.audio.mergeAudio;
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
        state.tracks = createAudioTracks(action.payload.media, action.payload.snapshot);
        if (action.payload.snapshot) {
          state.masterEnabled = action.payload.snapshot.audio.master.enabled;
          state.masterVolumePercent = action.payload.snapshot.audio.master.volumePercent;
          state.mergeAudio = action.payload.snapshot.audio.mergeAudio;
        }
      });
  },
});

function createAudioTracks(media: MediaInfo, snapshot?: EditorSnapshot): AudioTrackState[] {
  const savedTracks = new Map(snapshot?.audio.tracks.map((track) => [track.streamIndex, track]));
  return media.audioStreams.map((stream) => {
    const saved = savedTracks.get(stream.streamIndex);
    return {
      streamIndex: stream.streamIndex,
      enabled: saved?.enabled ?? true,
      volumePercent: saved?.volumePercent ?? DEFAULT_UNMUTE_VOLUME_PERCENT,
      waveform: { status: "idle" },
    };
  });
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
  audioMergeToggled,
  audioPreviewsLoading,
  audioPreviewsReady,
  audioPreviewsUnavailable,
  audioTrackToggled,
  audioTrackVolumeChanged,
  masterAudioToggled,
  masterVolumeChanged,
  waveformDisplayFailed,
  waveformReady,
  waveformsFailed,
  waveformsLoading,
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

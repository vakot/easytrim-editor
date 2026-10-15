import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import { editingInstanceActivated } from "@/app/store/actions/editing-instance-actions";
import { sourceCleared, sourceReady, sourceSelected } from "@/app/store/actions/source-actions";
import { trimChanged } from "@/app/store/slices/trim-slice";
import {
  audioTrackActivityProcessingChanged,
  type AudioTrackProcessing,
  type AudioTrackSettings,
  cloneAudioTrackProcessing,
  DEFAULT_AUDIO_TRACK_PROCESSING,
  getAudioTrackPreLevelEffects,
  normalizeAudioTrackDefaults,
  sameAudioTrackLoudnessInputs,
  sameAudioTrackProcessing,
} from "@/domain/audio-processing";
import type { EditorSnapshot } from "@/domain/editor-snapshot";
import { normalizeMetadataLanguageCode } from "@/domain/languages";
import type { AudioActivityRange, LoudnessAnalysis } from "@/domain/media";
import type { AppError, MediaInfo, WaveformResult } from "@/lib/tauri/media.types";

import type { RootState } from "../store";

type WaveformState =
  | { status: "idle" }
  | { jobId: string; status: "loading"; width: number }
  | { jobId: string; status: "ready"; url: string; width: number }
  | { error: AppError; jobId: string; status: "failed"; width: number };

type AudioTrackAnalysis<T> =
  | { status: "idle" }
  | { cacheKey?: string; operationId: string; status: "loading" }
  | { cacheKey?: string; operationId: string; status: "ready"; value: T }
  | { cacheKey?: string; error: AppError; operationId: string; status: "failed" };

interface AudioTrackState extends AudioTrackSettings {
  activityAnalysis: AudioTrackAnalysis<AudioActivityRange[]>;
  activityVisible: boolean;
  loudnessAnalysis: AudioTrackAnalysis<LoudnessAnalysis>;
  waveform: WaveformState;
}

interface AudioState {
  tracks: AudioTrackState[];
}

export const initialAudioState: AudioState = {
  tracks: [],
};

const audioSlice = createSlice({
  name: "audio",
  initialState: initialAudioState,
  reducers: {
    audioTrackToggled: (state, action: PayloadAction<{ streamIndex: number }>) => {
      const track = state.tracks.find(
        (candidate) => candidate.streamIndex === action.payload.streamIndex,
      );

      if (!track) return;
      track.enabled = !track.enabled;
      state.tracks = normalizeAudioTrackDefaults(state.tracks);
    },
    audioTrackDefaultChanged: (state, action: PayloadAction<{ streamIndex: number }>) => {
      const track = state.tracks.find(
        (candidate) => candidate.streamIndex === action.payload.streamIndex,
      );

      if (!track?.enabled) return;
      for (const candidate of state.tracks) {
        candidate.metadata.isDefault = candidate.streamIndex === action.payload.streamIndex;
      }
      state.tracks = normalizeAudioTrackDefaults(state.tracks);
    },
    audioTrackMetadataChanged: (
      state,
      action: PayloadAction<{
        language: string | undefined;
        streamIndex: number;
        title: string | undefined;
      }>,
    ) => {
      const track = state.tracks.find(
        (candidate) => candidate.streamIndex === action.payload.streamIndex,
      );

      if (!track) return;
      track.metadata.language = normalizeMetadataLanguageCode(action.payload.language);
      track.metadata.title = action.payload.title || undefined;
    },
    audioTrackGainChanged: (
      state,
      action: PayloadAction<{ gainDb: number; streamIndex: number }>,
    ) => {
      const track = state.tracks.find(
        (candidate) => candidate.streamIndex === action.payload.streamIndex,
      );

      if (!track) return;
      if (track.processing.gainDb === action.payload.gainDb) return;
      track.processing.gainDb = action.payload.gainDb;
      if (track.processing.loudnessNormalization === undefined) {
        track.activityAnalysis = { status: "idle" };
      }
    },
    audioTrackProcessingChanged: (
      state,
      action: PayloadAction<{ processing: AudioTrackProcessing; streamIndex: number }>,
    ) => {
      const track = state.tracks.find(
        (candidate) => candidate.streamIndex === action.payload.streamIndex,
      );

      if (!track || sameAudioTrackProcessing(track.processing, action.payload.processing)) return;
      const activityChanged = audioTrackActivityProcessingChanged(
        track.processing,
        action.payload.processing,
      );

      const loudnessInputsChanged = !sameAudioTrackLoudnessInputs(
        track.processing,
        action.payload.processing,
      );

      const waveformInputsChanged =
        JSON.stringify(getAudioTrackPreLevelEffects(track.processing)) !==
        JSON.stringify(getAudioTrackPreLevelEffects(action.payload.processing));

      track.processing = cloneAudioTrackProcessing(action.payload.processing);
      if (waveformInputsChanged) track.waveform = { status: "idle" };
      if (loudnessInputsChanged) track.loudnessAnalysis = { status: "idle" };
      if (activityChanged) track.activityAnalysis = { status: "idle" };
    },
    audioTrackLoudnessNormalizationChanged: (
      state,
      action: PayloadAction<{
        preset: AudioTrackProcessing["loudnessNormalization"] | null;
        streamIndex: number;
      }>,
    ) => {
      const track = state.tracks.find(
        (candidate) => candidate.streamIndex === action.payload.streamIndex,
      );

      const processing = track
        ? cloneAudioTrackProcessing({
            gainDb: track.processing.gainDb,
            ...(action.payload.preset === null
              ? {}
              : { loudnessNormalization: action.payload.preset }),
          })
        : null;

      if (!track || processing === null || sameAudioTrackProcessing(track.processing, processing))
        return;
      const activityChanged = audioTrackActivityProcessingChanged(track.processing, processing);
      track.processing = processing;
      if (activityChanged) track.activityAnalysis = { status: "idle" };
    },
    audioTrackActivityVisibilityToggled: (
      state,
      action: PayloadAction<{ streamIndex: number }>,
    ) => {
      const track = state.tracks.find(
        (candidate) => candidate.streamIndex === action.payload.streamIndex,
      );

      if (track) track.activityVisible = !track.activityVisible;
    },
    audioTrackLoudnessAnalysisStarted: (
      state,
      action: PayloadAction<{ cacheKey: string; operationId: string; streamIndex: number }>,
    ) => {
      const track = state.tracks.find(
        (candidate) => candidate.streamIndex === action.payload.streamIndex,
      );

      if (track)
        track.loudnessAnalysis = {
          cacheKey: action.payload.cacheKey,
          operationId: action.payload.operationId,
          status: "loading",
        };
    },
    audioTrackLoudnessAnalysisReady: (
      state,
      action: PayloadAction<{
        cacheKey: string;
        operationId: string;
        result: LoudnessAnalysis;
        streamIndex: number;
      }>,
    ) => {
      const track = state.tracks.find(
        (candidate) => candidate.streamIndex === action.payload.streamIndex,
      );

      if (
        track?.loudnessAnalysis.status === "loading" &&
        track.loudnessAnalysis.operationId === action.payload.operationId
      ) {
        track.loudnessAnalysis = {
          cacheKey: action.payload.cacheKey,
          operationId: action.payload.operationId,
          status: "ready",
          value: action.payload.result,
        };
      }
    },
    audioTrackLoudnessAnalysisFailed: (
      state,
      action: PayloadAction<{
        cacheKey: string;
        error: AppError;
        operationId: string;
        streamIndex: number;
      }>,
    ) => {
      const track = state.tracks.find(
        (candidate) => candidate.streamIndex === action.payload.streamIndex,
      );

      if (
        track?.loudnessAnalysis.status === "loading" &&
        track.loudnessAnalysis.operationId === action.payload.operationId
      ) {
        track.loudnessAnalysis = { ...action.payload, status: "failed" };
      }
    },
    audioTrackActivityAnalysisStarted: (
      state,
      action: PayloadAction<{ operationId: string; streamIndex: number }>,
    ) => {
      const track = state.tracks.find(
        (candidate) => candidate.streamIndex === action.payload.streamIndex,
      );

      if (track)
        track.activityAnalysis = { operationId: action.payload.operationId, status: "loading" };
    },
    audioTrackActivityAnalysisReady: (
      state,
      action: PayloadAction<{
        operationId: string;
        result: AudioActivityRange[];
        streamIndex: number;
      }>,
    ) => {
      const track = state.tracks.find(
        (candidate) => candidate.streamIndex === action.payload.streamIndex,
      );

      if (
        track?.activityAnalysis.status === "loading" &&
        track.activityAnalysis.operationId === action.payload.operationId
      ) {
        track.activityAnalysis = {
          operationId: action.payload.operationId,
          status: "ready",
          value: action.payload.result,
        };
        track.activityVisible = true;
      }
    },
    audioTrackActivityAnalysisFailed: (
      state,
      action: PayloadAction<{ error: AppError; operationId: string; streamIndex: number }>,
    ) => {
      const track = state.tracks.find(
        (candidate) => candidate.streamIndex === action.payload.streamIndex,
      );

      if (
        track?.activityAnalysis.status === "loading" &&
        track.activityAnalysis.operationId === action.payload.operationId
      ) {
        track.activityAnalysis = { ...action.payload, status: "failed" };
      }
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
            messageId: "media.waveform.previewCouldNotBeDisplayed",
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
      .addCase(trimChanged, (state) => {
        for (const track of state.tracks) {
          track.loudnessAnalysis = { status: "idle" };
        }
      })
      .addCase(sourceSelected, (state) => {
        state.tracks = [];
      })
      .addCase(editingInstanceActivated, (state, action) => {
        const { media, snapshot } = action.payload;
        state.tracks = media ? createAudioTracks(media, snapshot) : [];
      })
      .addCase(sourceCleared, (state) => {
        state.tracks = [];
      })
      .addCase(sourceReady, (state, action) => {
        state.tracks = createAudioTracks(action.payload.media, action.payload.snapshot);
      });
  },
});

function createAudioTracks(media: MediaInfo, snapshot?: EditorSnapshot): AudioTrackState[] {
  const savedTracks = new Map(snapshot?.audio.tracks.map((track) => [track.streamIndex, track]));
  const sourceDefault =
    media.audioStreams.find((stream) => stream.isDefault) ?? media.audioStreams[0];

  const snapshotHasDefaultState = snapshot?.audio.tracks.some(
    (track) => track.metadata.isDefault !== undefined,
  );

  const defaultStreamIndex = snapshotHasDefaultState
    ? snapshot?.audio.tracks.find((track) => track.metadata.isDefault)?.streamIndex
    : sourceDefault?.streamIndex;

  const tracks: AudioTrackState[] = media.audioStreams.map((stream) => {
    const saved = savedTracks.get(stream.streamIndex);
    return {
      streamIndex: stream.streamIndex,
      enabled: saved?.enabled ?? true,
      metadata: {
        isDefault: stream.streamIndex === defaultStreamIndex,
        language: normalizeMetadataLanguageCode(saved?.metadata.language),
        title: saved?.metadata.title || undefined,
      },
      processing: saved?.processing
        ? { ...saved.processing }
        : { ...DEFAULT_AUDIO_TRACK_PROCESSING },
      waveform: { status: "idle" },
      loudnessAnalysis: { status: "idle" },
      activityAnalysis: { status: "idle" },
      activityVisible: true,
    };
  });

  return normalizeAudioTrackDefaults(tracks);
}

function applyWaveformResult(state: AudioState, result: WaveformResult) {
  const track = state.tracks.find((candidate) => candidate.streamIndex === result.streamIndex);
  if (!track || track.waveform.status !== "loading" || track.waveform.jobId !== result.jobId)
    return;
  const disabledSilentTrack =
    result.status === "ready" && result.hasSignal === false && track.enabled;

  if (disabledSilentTrack) {
    track.enabled = false;
  }
  track.waveform =
    result.status === "ready"
      ? { status: "ready", jobId: result.jobId, width: result.width, url: result.url }
      : { status: "failed", jobId: result.jobId, width: result.width, error: result.error };
  if (disabledSilentTrack) state.tracks = normalizeAudioTrackDefaults(state.tracks);
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

const {
  audioTrackActivityAnalysisFailed,
  audioTrackActivityAnalysisReady,
  audioTrackActivityAnalysisStarted,
  audioTrackActivityVisibilityToggled,
  audioTrackDefaultChanged,
  audioTrackGainChanged,
  audioTrackLoudnessAnalysisFailed,
  audioTrackLoudnessAnalysisReady,
  audioTrackLoudnessAnalysisStarted,
  audioTrackLoudnessNormalizationChanged,
  audioTrackMetadataChanged,
  audioTrackProcessingChanged,
  audioTrackToggled,
  waveformDisplayFailed,
  waveformReady,
  waveformsFailed,
  waveformsLoading,
} = audioSlice.actions;

const audioReducer = audioSlice.reducer;

const EMPTY_AUDIO_TRACKS: AudioTrackState[] = [];

const selectAudioTracks = (state: RootState): AudioTrackState[] =>
  state.audio.tracks.length > 0 ? state.audio.tracks : EMPTY_AUDIO_TRACKS;

export {
  audioReducer,
  audioTrackActivityAnalysisFailed,
  audioTrackActivityAnalysisReady,
  audioTrackActivityAnalysisStarted,
  audioTrackActivityVisibilityToggled,
  audioTrackDefaultChanged,
  audioTrackGainChanged,
  audioTrackLoudnessAnalysisFailed,
  audioTrackLoudnessAnalysisReady,
  audioTrackLoudnessAnalysisStarted,
  audioTrackLoudnessNormalizationChanged,
  audioTrackMetadataChanged,
  audioTrackProcessingChanged,
  audioTrackToggled,
  selectAudioTracks,
  waveformDisplayFailed,
  waveformReady,
  waveformsFailed,
  waveformsLoading,
};

export type { AudioTrackState };

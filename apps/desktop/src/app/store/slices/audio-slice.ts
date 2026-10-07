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
  sameAudioTrackLoudnessInputs,
  sameAudioTrackPreviewProcessing,
  sameAudioTrackProcessing,
} from "@/domain/audio-processing";
import type { EditorSnapshot } from "@/domain/editor-snapshot";
import type { AudioActivityRange, LoudnessAnalysis } from "@/domain/media";
import { t } from "@/i18n/config";
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

type AudioTrackAnalysis<T> =
  | { status: "idle" }
  | { cacheKey?: string; operationId: string; status: "loading" }
  | { cacheKey?: string; operationId: string; status: "ready"; value: T }
  | { cacheKey?: string; error: AppError; operationId: string; status: "failed" };

type AudioTrackPreviewState =
  | { status: "idle" }
  | { descriptor?: AudioPreviewDescriptor; operationId: string; status: "loading" }
  | { descriptor: AudioPreviewDescriptor; status: "ready" }
  | { descriptor: AudioPreviewDescriptor; status: "stale" }
  | { descriptor?: AudioPreviewDescriptor; error: AppError; operationId: string; status: "failed" };

type AudioPreviewState =
  | { previews: AudioPreviewDescriptor[]; status: "idle" }
  | { previews: AudioPreviewDescriptor[]; status: "loading" }
  | { previews: AudioPreviewDescriptor[]; status: "ready" }
  | {
      error: AppError;
      previews: AudioPreviewDescriptor[];
      status: "unavailable";
    };

interface AudioTrackState extends AudioTrackSettings {
  activityAnalysis: AudioTrackAnalysis<AudioActivityRange[]>;
  activityVisible: boolean;
  loudnessAnalysis: AudioTrackAnalysis<LoudnessAnalysis>;
  preview: AudioTrackPreviewState;
  waveform: WaveformState;
}

interface AudioState {
  mergeAudio: boolean;
  previews: AudioPreviewState | null;
  tracks: AudioTrackState[];
}

export const initialAudioState: AudioState = {
  tracks: [],
  mergeAudio: false,
  previews: null,
};

const audioSlice = createSlice({
  name: "audio",
  initialState: initialAudioState,
  reducers: {
    audioPreviewsLoading: (state) => {
      state.previews = { status: "loading", previews: state.previews?.previews ?? [] };
    },
    audioPreviewsReady: (state, action: PayloadAction<{ previews: AudioPreviewDescriptor[] }>) => {
      state.previews = {
        status: "ready",
        previews: action.payload.previews,
      };
      for (const track of state.tracks) {
        if (
          track.preview.status === "loading" ||
          track.preview.status === "stale" ||
          (track.preview.status === "failed" && track.preview.operationId !== "initial")
        )
          continue;
        const descriptor = action.payload.previews.find(
          (preview) => preview.streamIndex === track.streamIndex,
        );

        if (
          track.preview.status === "ready" &&
          descriptor &&
          track.preview.descriptor.previewRevision > descriptor.previewRevision
        ) {
          continue;
        }
        track.preview =
          descriptor && sameAudioTrackPreviewProcessing(descriptor.processing, track.processing)
            ? { descriptor, status: "ready" }
            : { status: "idle" };
      }
    },
    audioPreviewsUnavailable: (state, action: PayloadAction<{ error: AppError }>) => {
      state.previews = {
        status: "unavailable",
        previews: [],
        error: action.payload.error,
      };
      for (const track of state.tracks) {
        if (track.preview.status === "loading") continue;
        track.preview = {
          error: action.payload.error,
          operationId: "initial",
          status: "failed",
        };
      }
    },
    audioTrackPreviewStarted: (
      state,
      action: PayloadAction<{ operationId: string; streamIndex: number }>,
    ) => {
      const track = state.tracks.find(
        (candidate) => candidate.streamIndex === action.payload.streamIndex,
      );

      if (track) {
        const descriptor =
          track.preview.status === "ready" || track.preview.status === "stale"
            ? track.preview.descriptor
            : track.preview.status === "loading"
              ? track.preview.descriptor
              : undefined;

        track.preview = {
          ...(descriptor ? { descriptor } : {}),
          operationId: action.payload.operationId,
          status: "loading",
        };
      }
    },
    audioTrackPreviewReady: (
      state,
      action: PayloadAction<{ descriptor: AudioPreviewDescriptor; operationId: string }>,
    ) => {
      const track = state.tracks.find(
        (candidate) => candidate.streamIndex === action.payload.descriptor.streamIndex,
      );

      if (
        !track ||
        track.preview.status !== "loading" ||
        track.preview.operationId !== action.payload.operationId ||
        !sameAudioTrackPreviewProcessing(track.processing, action.payload.descriptor.processing)
      ) {
        return;
      }
      track.preview = { descriptor: action.payload.descriptor, status: "ready" };
      const previews = state.previews?.previews ?? [];
      state.previews = {
        status: "ready",
        previews: [
          ...previews.filter(
            (preview) => preview.streamIndex !== action.payload.descriptor.streamIndex,
          ),
          action.payload.descriptor,
        ],
      };
    },
    audioTrackPreviewFailed: (
      state,
      action: PayloadAction<{ error: AppError; operationId: string; streamIndex: number }>,
    ) => {
      const track = state.tracks.find(
        (candidate) => candidate.streamIndex === action.payload.streamIndex,
      );

      if (
        track?.preview.status === "loading" &&
        track.preview.operationId === action.payload.operationId
      ) {
        track.preview = {
          ...(track.preview.descriptor ? { descriptor: track.preview.descriptor } : {}),
          ...action.payload,
          status: "failed",
        };
      }
    },
    audioTrackToggled: (state, action: PayloadAction<{ streamIndex: number }>) => {
      const track = state.tracks.find(
        (candidate) => candidate.streamIndex === action.payload.streamIndex,
      );

      if (!track) return;
      track.enabled = !track.enabled;
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
      if (
        !sameAudioTrackPreviewProcessing(
          track.processing,
          ("descriptor" in track.preview && track.preview.descriptor?.processing) ||
            track.processing,
        )
      ) {
        track.preview = staleAudioTrackPreview(track.preview);
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

      const previewChanged = !sameAudioTrackPreviewProcessing(
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
      if (previewChanged) track.preview = staleAudioTrackPreview(track.preview);
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
      const previewChanged = !sameAudioTrackPreviewProcessing(track.processing, processing);
      track.processing = processing;
      if (activityChanged) track.activityAnalysis = { status: "idle" };
      if (previewChanged) track.preview = staleAudioTrackPreview(track.preview);
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
          if (track.processing.loudnessNormalization !== undefined) {
            track.preview = staleAudioTrackPreview(track.preview);
          }
        }
      })
      .addCase(sourceSelected, (state, action) => {
        state.tracks = [];
        state.mergeAudio = action.payload.mergeAudio ?? false;
        state.previews = {
          status: "idle",
          previews: [],
        };
      })
      .addCase(editingInstanceActivated, (state, action) => {
        const { media, snapshot } = action.payload;
        state.tracks = media ? createAudioTracks(media, snapshot) : [];
        state.mergeAudio = snapshot.audio.mergeAudio;
        state.previews = {
          status: "idle",
          previews: [],
        };
      })
      .addCase(sourceCleared, (state) => {
        state.tracks = [];
        state.mergeAudio = false;
        state.previews = null;
      })
      .addCase(sourceReady, (state, action) => {
        state.tracks = createAudioTracks(action.payload.media, action.payload.snapshot);
        if (action.payload.snapshot) {
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
      processing: saved?.processing
        ? { ...saved.processing }
        : { ...DEFAULT_AUDIO_TRACK_PROCESSING },
      waveform: { status: "idle" },
      loudnessAnalysis: { status: "idle" },
      activityAnalysis: { status: "idle" },
      preview: { status: "idle" },
      activityVisible: true,
    };
  });
}

function staleAudioTrackPreview(preview: AudioTrackPreviewState): AudioTrackPreviewState {
  const descriptor =
    preview.status === "ready" || preview.status === "stale" || preview.status === "loading"
      ? preview.descriptor
      : undefined;

  return descriptor ? { descriptor, status: "stale" } : { status: "idle" };
}

function applyWaveformResult(state: AudioState, result: WaveformResult) {
  const track = state.tracks.find((candidate) => candidate.streamIndex === result.streamIndex);
  if (!track || track.waveform.status !== "loading" || track.waveform.jobId !== result.jobId)
    return;
  if (result.status === "ready" && result.hasSignal === false && track.enabled) {
    track.enabled = false;
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

const {
  audioMergeToggled,
  audioPreviewsLoading,
  audioPreviewsReady,
  audioPreviewsUnavailable,
  audioTrackActivityAnalysisFailed,
  audioTrackActivityAnalysisReady,
  audioTrackActivityAnalysisStarted,
  audioTrackActivityVisibilityToggled,
  audioTrackGainChanged,
  audioTrackLoudnessAnalysisFailed,
  audioTrackLoudnessAnalysisReady,
  audioTrackLoudnessAnalysisStarted,
  audioTrackLoudnessNormalizationChanged,
  audioTrackPreviewFailed,
  audioTrackPreviewReady,
  audioTrackPreviewStarted,
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

const selectMergeAudio = (state: RootState): boolean => state.audio.mergeAudio;

function audioTrackPlaybackPreviewUrl(
  track: AudioTrackState,
  routeRequiresExternalPreview: boolean,
): string | undefined {
  if (!routeRequiresExternalPreview) return undefined;
  const preview = track.preview;
  if (
    preview.status === "ready" &&
    sameAudioTrackPreviewProcessing(track.processing, preview.descriptor.processing)
  ) {
    return preview.descriptor.url;
  }
  if ((preview.status === "stale" || preview.status === "loading") && preview.descriptor) {
    return preview.descriptor.url;
  }
  return undefined;
}

export {
  audioMergeToggled,
  audioPreviewsLoading,
  audioPreviewsReady,
  audioPreviewsUnavailable,
  audioReducer,
  audioTrackActivityAnalysisFailed,
  audioTrackActivityAnalysisReady,
  audioTrackActivityAnalysisStarted,
  audioTrackActivityVisibilityToggled,
  audioTrackGainChanged,
  audioTrackLoudnessAnalysisFailed,
  audioTrackLoudnessAnalysisReady,
  audioTrackLoudnessAnalysisStarted,
  audioTrackLoudnessNormalizationChanged,
  audioTrackPlaybackPreviewUrl,
  audioTrackPreviewFailed,
  audioTrackPreviewReady,
  audioTrackPreviewStarted,
  audioTrackProcessingChanged,
  audioTrackToggled,
  selectAudioTracks,
  selectMergeAudio,
  waveformDisplayFailed,
  waveformReady,
  waveformsFailed,
  waveformsLoading,
};

export type { AudioTrackState };

import { createSelector, createSlice, type PayloadAction } from "@reduxjs/toolkit";

import type {
  AppError,
  MediaCapabilities,
  MediaInfo,
  PreviewDescriptor,
  PreviewKind,
  SourceSelection,
  WaveformResult,
} from "../../../lib/tauri/media";
import { createFullTrimRange, isValidTrimRange, type TrimRange } from "../../../domain/trim";
import type { RootState } from "../store";

export type CapabilityState =
  | { status: "checking" }
  | { status: "ready"; value: MediaCapabilities }
  | { status: "failed"; error: AppError };

export type PreviewState =
  | { status: "idle" }
  | { status: "loading"; kind: PreviewKind }
  | { status: "ready"; value: PreviewDescriptor }
  | { status: "failed"; error: AppError };

export type WaveformState =
  | { status: "idle" }
  | { status: "loading"; jobId: string; width: number }
  | { status: "ready"; jobId: string; width: number; url: string }
  | { status: "failed"; jobId: string; width: number; error: AppError };

export interface AudioTrackState {
  streamIndex: number;
  enabled: boolean;
  volumePercent: number;
  waveform: WaveformState;
}

const DEFAULT_UNMUTE_VOLUME_PERCENT = 50;

export interface SessionState {
  status: "idle" | "loading-source" | "ready" | "failed";
  capabilities: CapabilityState;
  source: {
    selection: SourceSelection;
    media: MediaInfo | null;
    preview: PreviewState;
    trim: TrimRange | null;
    audioTracks: AudioTrackState[];
    masterEnabled: boolean;
    masterVolumePercent: number;
    mergeAudio: boolean;
  } | null;
  lastError: AppError | null;
}

export const initialSessionState: SessionState = {
  status: "idle",
  capabilities: { status: "checking" },
  source: null,
  lastError: null,
};

const EMPTY_PREVIEW: PreviewState = { status: "idle" };
const EMPTY_AUDIO_TRACKS: AudioTrackState[] = [];

const sessionSlice = createSlice({
  name: "session",
  initialState: initialSessionState,
  reducers: {
    capabilitiesReady: (state, action: PayloadAction<MediaCapabilities>) => {
      state.capabilities = { status: "ready", value: action.payload };
    },
    capabilitiesFailed: (state, action: PayloadAction<AppError>) => {
      state.capabilities = { status: "failed", error: action.payload };
    },
    sourceCleared: (state) => {
      state.status = "idle";
      state.source = null;
      state.lastError = null;
    },
    sourceSelected: (
      state,
      action: PayloadAction<{ source: SourceSelection; mergeAudio?: boolean }>,
    ) => {
      state.status = "loading-source";
      state.source = {
        selection: action.payload.source,
        media: null,
        preview: { status: "idle" },
        trim: null,
        audioTracks: [],
        masterEnabled: true,
        masterVolumePercent: 50,
        mergeAudio: action.payload.mergeAudio ?? false,
      };
      state.lastError = null;
    },
    sourceReady: (state, action: PayloadAction<{ sourceId: string; media: MediaInfo }>) => {
      if (
        state.source?.selection.sourceId !== action.payload.sourceId ||
        action.payload.media.sourceId !== action.payload.sourceId
      )
        return;
      state.status = "ready";
      state.source.media = action.payload.media;
      state.source.trim = createFullTrimRange(action.payload.media.durationMicros);
      state.source.audioTracks = action.payload.media.audioStreams.map((stream) => ({
        streamIndex: stream.streamIndex,
        enabled: true,
        volumePercent: 50,
        waveform: { status: "idle" },
      }));
      state.lastError = null;
    },
    sourceFailed: (state, action: PayloadAction<{ sourceId?: string; error: AppError }>) => {
      if (action.payload.sourceId && state.source?.selection.sourceId !== action.payload.sourceId)
        return;
      state.status = "failed";
      if (!action.payload.sourceId) state.source = null;
      state.lastError = action.payload.error;
    },
    previewLoading: (state, action: PayloadAction<{ sourceId: string; kind: PreviewKind }>) => {
      if (state.source?.selection.sourceId !== action.payload.sourceId) return;
      state.source.preview = { status: "loading", kind: action.payload.kind };
    },
    previewReady: (
      state,
      action: PayloadAction<{ sourceId: string; preview: PreviewDescriptor }>,
    ) => {
      if (
        state.source?.selection.sourceId !== action.payload.sourceId ||
        action.payload.preview.sourceId !== action.payload.sourceId
      )
        return;
      state.source.preview = { status: "ready", value: action.payload.preview };
    },
    previewFailed: (state, action: PayloadAction<{ sourceId: string; error: AppError }>) => {
      if (state.source?.selection.sourceId !== action.payload.sourceId) return;
      state.source.preview = { status: "failed", error: action.payload.error };
    },
    trimChanged: (state, action: PayloadAction<{ sourceId: string; trim: TrimRange }>) => {
      if (
        state.source?.selection.sourceId !== action.payload.sourceId ||
        state.source.media?.durationMicros !== action.payload.trim.sourceDurationMicros ||
        !isValidTrimRange(action.payload.trim)
      )
        return;
      state.source.trim = action.payload.trim;
    },
    audioTrackToggled: (
      state,
      action: PayloadAction<{ sourceId: string; streamIndex: number }>,
    ) => {
      if (state.source?.selection.sourceId !== action.payload.sourceId) return;
      const track = state.source.audioTracks.find(
        (candidate) => candidate.streamIndex === action.payload.streamIndex,
      );
      if (!track) return;
      track.enabled = !track.enabled;
      if (track.enabled && track.volumePercent <= 0)
        track.volumePercent = DEFAULT_UNMUTE_VOLUME_PERCENT;
    },
    audioTracksSetEnabled: (
      state,
      action: PayloadAction<{ sourceId: string; enabled: boolean }>,
    ) => {
      if (state.source?.selection.sourceId !== action.payload.sourceId) return;
      for (const track of state.source.audioTracks) {
        track.enabled = action.payload.enabled;
        if (action.payload.enabled && track.volumePercent <= 0)
          track.volumePercent = DEFAULT_UNMUTE_VOLUME_PERCENT;
      }
    },
    audioTrackVolumeChanged: (
      state,
      action: PayloadAction<{ sourceId: string; streamIndex: number; volumePercent: number }>,
    ) => {
      if (state.source?.selection.sourceId !== action.payload.sourceId) return;
      const track = state.source.audioTracks.find(
        (candidate) => candidate.streamIndex === action.payload.streamIndex,
      );
      if (!track) return;
      track.enabled = action.payload.volumePercent > 0;
      track.volumePercent = action.payload.volumePercent;
    },
    masterAudioToggled: (state, action: PayloadAction<{ sourceId: string }>) => {
      if (state.source?.selection.sourceId !== action.payload.sourceId) return;
      state.source.masterEnabled = !state.source.masterEnabled;
      if (state.source.masterEnabled && state.source.masterVolumePercent <= 0)
        state.source.masterVolumePercent = DEFAULT_UNMUTE_VOLUME_PERCENT;
    },
    masterVolumeChanged: (
      state,
      action: PayloadAction<{ sourceId: string; volumePercent: number }>,
    ) => {
      if (state.source?.selection.sourceId !== action.payload.sourceId) return;
      state.source.masterEnabled = action.payload.volumePercent > 0;
      state.source.masterVolumePercent = action.payload.volumePercent;
    },
    audioMergeToggled: (state, action: PayloadAction<{ sourceId: string }>) => {
      if (state.source?.selection.sourceId !== action.payload.sourceId) return;
      state.source.mergeAudio = !state.source.mergeAudio;
    },
    audioMergeChanged: (state, action: PayloadAction<{ sourceId: string; enabled: boolean }>) => {
      if (state.source?.selection.sourceId !== action.payload.sourceId) return;
      state.source.mergeAudio = action.payload.enabled;
    },
    waveformsLoading: (
      state,
      action: PayloadAction<{
        sourceId: string;
        jobId: string;
        width: number;
        streamIndexes: number[];
      }>,
    ) => {
      if (state.source?.selection.sourceId !== action.payload.sourceId) return;
      state.source.audioTracks = updateWaveformTracks(
        state.source.audioTracks,
        action.payload.streamIndexes,
        () => ({ status: "loading", jobId: action.payload.jobId, width: action.payload.width }),
      );
    },
    waveformReady: (state, action: PayloadAction<WaveformResult>) => {
      applyWaveformResult(state, action.payload);
    },
    waveformDisplayFailed: (
      state,
      action: PayloadAction<{ sourceId: string; streamIndex: number }>,
    ) => {
      if (state.source?.selection.sourceId !== action.payload.sourceId) return;
      const track = state.source.audioTracks.find(
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
        sourceId: string;
        jobId: string;
        width: number;
        streamIndexes: number[];
        error: AppError;
      }>,
    ) => {
      if (state.source?.selection.sourceId !== action.payload.sourceId) return;
      state.source.audioTracks = updateWaveformTracks(
        state.source.audioTracks,
        action.payload.streamIndexes,
        (track) =>
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
});

function applyWaveformResult(state: SessionState, result: WaveformResult) {
  if (state.source?.selection.sourceId !== result.sourceId) return;
  const track = state.source.audioTracks.find(
    (candidate) => candidate.streamIndex === result.streamIndex,
  );
  if (!track || track.waveform.status !== "loading" || track.waveform.jobId !== result.jobId)
    return;
  if (
    result.status === "ready" &&
    result.hasSignal === false &&
    track.enabled &&
    track.volumePercent === 50
  ) {
    track.enabled = false;
    track.volumePercent = 0;
  }
  track.waveform =
    result.status === "ready"
      ? { status: "ready", jobId: result.jobId, width: result.width, url: result.url }
      : { status: "failed", jobId: result.jobId, width: result.width, error: result.error };
}

export const {
  capabilitiesReady,
  capabilitiesFailed,
  sourceCleared,
  sourceSelected,
  sourceReady,
  sourceFailed,
  previewLoading,
  previewReady,
  previewFailed,
  trimChanged,
  audioTrackToggled,
  audioTracksSetEnabled,
  audioTrackVolumeChanged,
  masterAudioToggled,
  masterVolumeChanged,
  audioMergeToggled,
  audioMergeChanged,
  waveformsLoading,
  waveformReady,
  waveformDisplayFailed,
  waveformsFailed,
} = sessionSlice.actions;

export const sessionReducer = sessionSlice.reducer;

export const selectSession = (state: RootState): SessionState => state.session;
export const selectSessionStatus = (state: RootState): SessionState["status"] =>
  selectSession(state).status;
export const selectCapabilities = (state: RootState): CapabilityState =>
  selectSession(state).capabilities;
export const selectActiveSource = (state: RootState): SessionState["source"] =>
  selectSession(state).source;
export const selectSourceSelection = (state: RootState): SourceSelection | null =>
  selectActiveSource(state)?.selection ?? null;
export const selectSourceMedia = (state: RootState): MediaInfo | null =>
  selectActiveSource(state)?.media ?? null;
export const selectPreview = (state: RootState): PreviewState =>
  selectActiveSource(state)?.preview ?? EMPTY_PREVIEW;
export const selectTrim = (state: RootState): TrimRange | null =>
  selectActiveSource(state)?.trim ?? null;
export const selectAudioTracks = (state: RootState): AudioTrackState[] =>
  selectActiveSource(state)?.audioTracks ?? EMPTY_AUDIO_TRACKS;
export const selectMasterAudio = createSelector([selectActiveSource], (source) => ({
  enabled: source?.masterEnabled ?? true,
  volumePercent: source?.masterVolumePercent ?? 50,
}));
export const selectMergeAudio = (state: RootState): boolean =>
  selectActiveSource(state)?.mergeAudio ?? false;
export const selectWaveforms = createSelector([selectAudioTracks], (tracks): WaveformState[] =>
  tracks.map((track) => track.waveform),
);
export const selectSessionError = (state: RootState): AppError | null =>
  selectSession(state).lastError;
export const selectHasSource = (state: RootState): boolean => selectActiveSource(state) !== null;
export const selectSourceReady = (state: RootState): boolean =>
  selectSessionStatus(state) === "ready" && Boolean(selectSourceMedia(state) && selectTrim(state));

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

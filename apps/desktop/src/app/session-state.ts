import type {
  AppError,
  MediaCapabilities,
  MediaInfo,
  PreviewDescriptor,
  PreviewKind,
  SourceSelection,
  WaveformResult,
} from "../lib/tauri/media";
import { createFullTrimRange, isValidTrimRange, type TrimRange } from "../domain/trim";

type CapabilityState =
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

const SAFE_UNMUTE_VOLUME_PERCENT = 50 * 10 ** (-12 / 20);

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

type SessionAction =
  | { type: "capabilities-ready"; capabilities: MediaCapabilities }
  | { type: "capabilities-failed"; error: AppError }
  | { type: "return-to-welcome" }
  | { type: "source-selected"; source: SourceSelection }
  | { type: "source-ready"; sourceId: string; media: MediaInfo }
  | { type: "source-failed"; sourceId?: string; error: AppError }
  | { type: "preview-loading"; sourceId: string; kind: PreviewKind }
  | { type: "preview-ready"; sourceId: string; preview: PreviewDescriptor }
  | { type: "preview-failed"; sourceId: string; error: AppError }
  | { type: "trim-changed"; sourceId: string; trim: TrimRange }
  | { type: "audio-track-toggled"; sourceId: string; streamIndex: number }
  | { type: "audio-tracks-set-enabled"; sourceId: string; enabled: boolean }
  | { type: "audio-master-toggled"; sourceId: string }
  | { type: "audio-master-volume-changed"; sourceId: string; volumePercent: number }
  | {
      type: "audio-track-volume-changed";
      sourceId: string;
      streamIndex: number;
      volumePercent: number;
    }
  | { type: "audio-merge-toggled"; sourceId: string }
  | {
      type: "waveforms-loading";
      sourceId: string;
      jobId: string;
      width: number;
      streamIndexes: number[];
    }
  | { type: "waveform-result"; result: WaveformResult }
  | { type: "waveform-display-failed"; sourceId: string; streamIndex: number }
  | {
      type: "waveforms-failed";
      sourceId: string;
      jobId: string;
      width: number;
      streamIndexes: number[];
      error: AppError;
    };

export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case "capabilities-ready":
      return {
        ...state,
        capabilities: { status: "ready", value: action.capabilities },
      };
    case "capabilities-failed":
      return {
        ...state,
        capabilities: { status: "failed", error: action.error },
      };
    case "return-to-welcome":
      return {
        ...state,
        status: "idle",
        source: null,
        lastError: null,
      };
    case "source-selected":
      return {
        ...state,
        status: "loading-source",
        source: {
          selection: action.source,
          media: null,
          preview: { status: "idle" },
          trim: null,
          audioTracks: [],
          masterEnabled: true,
          masterVolumePercent: 50,
          mergeAudio: false,
        },
        lastError: null,
      };
    case "source-ready":
      if (
        state.source?.selection.sourceId !== action.sourceId ||
        action.media.sourceId !== action.sourceId
      ) {
        return state;
      }
      return {
        ...state,
        status: "ready",
        source: {
          ...state.source,
          media: action.media,
          trim: createFullTrimRange(action.media.durationMicros),
          audioTracks: action.media.audioStreams.map((stream) => ({
            streamIndex: stream.streamIndex,
            enabled: true,
            volumePercent: 50,
            waveform: { status: "idle" },
          })),
        },
        lastError: null,
      };
    case "source-failed":
      if (action.sourceId && state.source?.selection.sourceId !== action.sourceId) {
        return state;
      }
      return {
        ...state,
        status: "failed",
        source: action.sourceId ? state.source : null,
        lastError: action.error,
      };
    case "preview-loading":
      if (state.source?.selection.sourceId !== action.sourceId) {
        return state;
      }
      return {
        ...state,
        source: {
          ...state.source,
          preview: { status: "loading", kind: action.kind },
        },
      };
    case "preview-ready":
      if (
        state.source?.selection.sourceId !== action.sourceId ||
        action.preview.sourceId !== action.sourceId
      ) {
        return state;
      }
      return {
        ...state,
        source: {
          ...state.source,
          preview: { status: "ready", value: action.preview },
        },
      };
    case "preview-failed":
      if (state.source?.selection.sourceId !== action.sourceId) {
        return state;
      }
      return {
        ...state,
        source: {
          ...state.source,
          preview: { status: "failed", error: action.error },
        },
      };
    case "trim-changed":
      if (
        state.source?.selection.sourceId !== action.sourceId ||
        state.source.media?.durationMicros !== action.trim.sourceDurationMicros ||
        !isValidTrimRange(action.trim)
      ) {
        return state;
      }
      return {
        ...state,
        source: {
          ...state.source,
          trim: action.trim,
        },
      };
    case "audio-track-toggled":
      if (state.source?.selection.sourceId !== action.sourceId) {
        return state;
      }
      return {
        ...state,
        source: {
          ...state.source,
          audioTracks: state.source.audioTracks.map((track) =>
            track.streamIndex === action.streamIndex
              ? {
                  ...track,
                  enabled: !track.enabled,
                  volumePercent:
                    !track.enabled && track.volumePercent <= 0
                      ? SAFE_UNMUTE_VOLUME_PERCENT
                      : track.volumePercent,
                }
              : track,
          ),
        },
      };
    case "audio-tracks-set-enabled":
      if (state.source?.selection.sourceId !== action.sourceId) {
        return state;
      }
      return {
        ...state,
        source: {
          ...state.source,
          audioTracks: state.source.audioTracks.map((track) => ({
            ...track,
            enabled: action.enabled,
          })),
        },
      };
    case "audio-track-volume-changed":
      if (state.source?.selection.sourceId !== action.sourceId) {
        return state;
      }
      return {
        ...state,
        source: {
          ...state.source,
          audioTracks: state.source.audioTracks.map((track) =>
            track.streamIndex === action.streamIndex
              ? {
                  ...track,
                  enabled: action.volumePercent > 0,
                  volumePercent: action.volumePercent,
                }
              : track,
          ),
        },
      };
    case "audio-master-toggled":
      if (state.source?.selection.sourceId !== action.sourceId) {
        return state;
      }
      return {
        ...state,
        source: {
          ...state.source,
          masterEnabled: !state.source.masterEnabled,
          masterVolumePercent:
            !state.source.masterEnabled && state.source.masterVolumePercent <= 0
              ? SAFE_UNMUTE_VOLUME_PERCENT
              : state.source.masterVolumePercent,
        },
      };
    case "audio-master-volume-changed":
      if (state.source?.selection.sourceId !== action.sourceId) {
        return state;
      }
      return {
        ...state,
        source: {
          ...state.source,
          masterEnabled: action.volumePercent > 0,
          masterVolumePercent: action.volumePercent,
        },
      };
    case "audio-merge-toggled":
      if (state.source?.selection.sourceId !== action.sourceId) {
        return state;
      }
      return {
        ...state,
        source: {
          ...state.source,
          mergeAudio: !state.source.mergeAudio,
        },
      };
    case "waveforms-loading":
      if (state.source?.selection.sourceId !== action.sourceId) {
        return state;
      }
      return {
        ...state,
        source: {
          ...state.source,
          audioTracks: updateWaveformTracks(state.source.audioTracks, action.streamIndexes, () => ({
            status: "loading",
            jobId: action.jobId,
            width: action.width,
          })),
        },
      };
    case "waveform-result":
      if (state.source?.selection.sourceId !== action.result.sourceId) {
        return state;
      }
      return {
        ...state,
        source: {
          ...state.source,
          audioTracks: state.source.audioTracks.map((track) => {
            if (
              track.streamIndex !== action.result.streamIndex ||
              track.waveform.status !== "loading" ||
              track.waveform.jobId !== action.result.jobId
            ) {
              return track;
            }
            return {
              ...track,
              waveform:
                action.result.status === "ready"
                  ? {
                      status: "ready",
                      jobId: action.result.jobId,
                      width: action.result.width,
                      url: action.result.url,
                    }
                  : {
                      status: "failed",
                      jobId: action.result.jobId,
                      width: action.result.width,
                      error: action.result.error,
                    },
            };
          }),
        },
      };
    case "waveform-display-failed":
      if (state.source?.selection.sourceId !== action.sourceId) {
        return state;
      }
      return {
        ...state,
        source: {
          ...state.source,
          audioTracks: state.source.audioTracks.map((track) =>
            track.streamIndex === action.streamIndex && track.waveform.status === "ready"
              ? {
                  ...track,
                  waveform: {
                    status: "failed",
                    jobId: track.waveform.jobId,
                    width: track.waveform.width,
                    error: {
                      code: "waveform_failed",
                      message: "The waveform preview could not be displayed.",
                    },
                  },
                }
              : track,
          ),
        },
      };
    case "waveforms-failed":
      if (state.source?.selection.sourceId !== action.sourceId) {
        return state;
      }
      return {
        ...state,
        source: {
          ...state.source,
          audioTracks: updateWaveformTracks(
            state.source.audioTracks,
            action.streamIndexes,
            (track) =>
              track.waveform.status === "loading" && track.waveform.jobId === action.jobId
                ? {
                    status: "failed",
                    jobId: action.jobId,
                    width: action.width,
                    error: action.error,
                  }
                : track.waveform,
          ),
        },
      };
  }
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

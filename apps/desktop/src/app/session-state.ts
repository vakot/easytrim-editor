import type {
  AppError,
  MediaCapabilities,
  MediaInfo,
  PreviewDescriptor,
  PreviewKind,
  SourceSelection,
} from "../lib/tauri/media";

type CapabilityState =
  | { status: "checking" }
  | { status: "ready"; value: MediaCapabilities }
  | { status: "failed"; error: AppError };

export type PreviewState =
  | { status: "idle" }
  | { status: "loading"; kind: PreviewKind }
  | { status: "ready"; value: PreviewDescriptor }
  | { status: "failed"; error: AppError };

export interface SessionState {
  status: "idle" | "loading-source" | "ready" | "failed";
  capabilities: CapabilityState;
  source: {
    selection: SourceSelection;
    media: MediaInfo | null;
    preview: PreviewState;
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
  | { type: "source-selected"; source: SourceSelection }
  | { type: "source-ready"; sourceId: string; media: MediaInfo }
  | { type: "source-failed"; sourceId?: string; error: AppError }
  | { type: "preview-loading"; sourceId: string; kind: PreviewKind }
  | { type: "preview-ready"; sourceId: string; preview: PreviewDescriptor }
  | { type: "preview-failed"; sourceId: string; error: AppError };

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
    case "source-selected":
      return {
        ...state,
        status: "loading-source",
        source: { selection: action.source, media: null, preview: { status: "idle" } },
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
        source: { ...state.source, media: action.media },
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
  }
}

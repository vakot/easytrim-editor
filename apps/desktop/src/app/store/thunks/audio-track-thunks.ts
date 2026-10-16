import {
  audioTrackActivityAnalysisFailed,
  audioTrackActivityAnalysisReady,
  audioTrackActivityAnalysisStarted,
  audioTrackLoudnessAnalysisFailed,
  audioTrackLoudnessAnalysisReady,
  audioTrackLoudnessAnalysisStarted,
  type AudioTrackState,
  selectAudioTracks,
} from "@/app/store/slices/audio-slice";
import { selectSourceMedia, selectSourceSelection } from "@/app/store/slices/source-slice";
import { selectTrim } from "@/app/store/slices/trim-slice";
import type { AppThunk } from "@/app/store/thunks/source-media-thunks";
import {
  type AudioChainSelection,
  type AudioFilter,
  audioTrackLoudnessInputsKey,
  sameAudioFilters,
} from "@/domain/audio-processing";
import { analyzeAudioLoudness, detectAudioActivity } from "@/lib/tauri/media";
import { normalizeAppError } from "@/lib/tauri/media.utils";

const activeLoudnessAnalysisJobs = new Map<string, Promise<void>>();

/**
 * Measures every loudness normalization instance of a chain. Native code measures each instance
 * on the signal that reaches it, in order, so one request covers dependent instances.
 */
function analyzeTrackLoudness(
  streamIndex: number,
  filtersOverride?: AudioFilter[],
): AppThunk<Promise<void>> {
  return async (dispatch, getState) => {
    const state = getState();
    const source = selectSourceSelection(state);
    const trim = selectTrim(state);
    const track = selectAudioTracks(state).find((item) => item.streamIndex === streamIndex);
    if (!source || !trim || !track) return;

    const filters = filtersOverride ?? track.processing.filters;
    const cacheKey = audioTrackLoudnessInputsKey(source.sourcePath, streamIndex, trim, filters);
    if (cacheKey === null) return;

    const jobKey = `${source.sourcePath}:${state.source.loadToken}:${cacheKey}`;
    if (
      (track.loudnessAnalysis.status === "ready" || track.loudnessAnalysis.status === "loading") &&
      track.loudnessAnalysis.cacheKey === cacheKey
    ) {
      const activeJob = activeLoudnessAnalysisJobs.get(jobKey);
      if (activeJob) await activeJob;
      return;
    }

    const activeJob = activeLoudnessAnalysisJobs.get(jobKey);
    if (activeJob) {
      await activeJob;
      return;
    }

    const operationId = crypto.randomUUID();
    const sourceLoadToken = state.source.loadToken;
    const audioTrack: AudioChainSelection = {
      filters: filters.map((filter) => ({ ...filter })),
      streamIndex: track.streamIndex,
    };

    dispatch(audioTrackLoudnessAnalysisStarted({ cacheKey, operationId, streamIndex }));
    const job = (async () => {
      try {
        const result = await analyzeAudioLoudness({
          audioTrack,
          sourcePath: source.sourcePath,
          trim: { startMicros: trim.startMicros, endMicros: trim.endMicros },
        });

        if (
          !isCurrentAnalysisTrack(
            getState(),
            source.sourcePath,
            sourceLoadToken,
            streamIndex,
            cacheKey,
          )
        )
          return;
        dispatch(audioTrackLoudnessAnalysisReady({ cacheKey, operationId, result, streamIndex }));
      } catch (error: unknown) {
        dispatch(
          audioTrackLoudnessAnalysisFailed({
            error: normalizeAppError(error),
            cacheKey,
            operationId,
            streamIndex,
          }),
        );
      }
    })();

    activeLoudnessAnalysisJobs.set(jobKey, job);
    try {
      await job;
    } finally {
      if (activeLoudnessAnalysisJobs.get(jobKey) === job) activeLoudnessAnalysisJobs.delete(jobKey);
    }
  };
}

function detectTrackActivity(streamIndex: number): AppThunk<Promise<void>> {
  return async (dispatch, getState) => {
    let state = getState();
    const source = selectSourceSelection(state);
    const media = selectSourceMedia(state);
    let track = selectAudioTracks(state).find((item) => item.streamIndex === streamIndex);
    if (!source || !media || !track) return;

    let trim = selectTrim(state);
    if (!trim) return;
    let cacheKey = audioTrackLoudnessInputsKey(
      source.sourcePath,
      streamIndex,
      trim,
      track.processing.filters,
    );

    if (cacheKey !== null && !hasCurrentMeasurements(track, cacheKey)) {
      await dispatch(analyzeTrackLoudness(streamIndex));
      state = getState();
      track = selectAudioTracks(state).find((item) => item.streamIndex === streamIndex);
      trim = selectTrim(state);
      if (!track || !trim) return;
      cacheKey = audioTrackLoudnessInputsKey(
        source.sourcePath,
        streamIndex,
        trim,
        track.processing.filters,
      );
      if (cacheKey !== null && !hasCurrentMeasurements(track, cacheKey)) return;
    }

    const operationId = crypto.randomUUID();
    const sourceLoadToken = state.source.loadToken;
    const audioTrack = audioChainSelection(track, cacheKey);
    dispatch(audioTrackActivityAnalysisStarted({ operationId, streamIndex }));
    try {
      const result = await detectAudioActivity(source.sourcePath, audioTrack, media.durationMicros);
      if (!isCurrentTrack(getState(), source.sourcePath, sourceLoadToken, audioTrack)) return;
      dispatch(audioTrackActivityAnalysisReady({ operationId, result, streamIndex }));
    } catch (error: unknown) {
      dispatch(
        audioTrackActivityAnalysisFailed({
          error: normalizeAppError(error),
          operationId,
          streamIndex,
        }),
      );
    }
  };
}

function hasCurrentMeasurements(track: AudioTrackState, cacheKey: string): boolean {
  return track.loudnessAnalysis.status === "ready" && track.loudnessAnalysis.cacheKey === cacheKey;
}

/** The chain without Track Volume, carrying measurements only when they match the chain. */
function audioChainSelection(
  track: AudioTrackState,
  loudnessCacheKey: string | null,
): AudioChainSelection {
  return {
    filters: track.processing.filters.map((filter) => ({ ...filter })),
    ...(loudnessCacheKey !== null &&
    track.loudnessAnalysis.status === "ready" &&
    track.loudnessAnalysis.cacheKey === loudnessCacheKey
      ? {
          loudnessMeasurements: track.loudnessAnalysis.value.map((measurement) => ({
            ...measurement,
          })),
        }
      : {}),
    streamIndex: track.streamIndex,
  };
}

function isCurrentTrack(
  state: ReturnType<Parameters<AppThunk>[1]>,
  sourcePath: string,
  sourceLoadToken: number,
  audioTrack: AudioChainSelection,
): boolean {
  const currentTrack = selectAudioTracks(state).find(
    (track) => track.streamIndex === audioTrack.streamIndex,
  );

  const trim = selectTrim(state);
  if (
    state.source.loadToken !== sourceLoadToken ||
    selectSourceSelection(state)?.sourcePath !== sourcePath ||
    !currentTrack ||
    !trim ||
    !sameAudioFilters(currentTrack.processing.filters, audioTrack.filters)
  ) {
    return false;
  }
  if (audioTrack.loudnessMeasurements === undefined) return true;

  const loudnessCacheKey = audioTrackLoudnessInputsKey(
    sourcePath,
    audioTrack.streamIndex,
    trim,
    audioTrack.filters,
  );

  return loudnessCacheKey !== null && hasCurrentMeasurements(currentTrack, loudnessCacheKey);
}

function isCurrentAnalysisTrack(
  state: ReturnType<Parameters<AppThunk>[1]>,
  sourcePath: string,
  sourceLoadToken: number,
  streamIndex: number,
  cacheKey: string,
): boolean {
  return (
    state.source.loadToken === sourceLoadToken &&
    selectSourceSelection(state)?.sourcePath === sourcePath &&
    selectAudioTracks(state).some(
      (track) =>
        track.streamIndex === streamIndex &&
        track.loudnessAnalysis.status === "loading" &&
        track.loudnessAnalysis.cacheKey === cacheKey,
    )
  );
}

export { analyzeTrackLoudness, audioChainSelection, detectTrackActivity };

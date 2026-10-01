import {
  audioTrackActivityAnalysisFailed,
  audioTrackActivityAnalysisReady,
  audioTrackActivityAnalysisStarted,
  audioTrackLoudnessAnalysisFailed,
  audioTrackLoudnessAnalysisReady,
  audioTrackLoudnessAnalysisStarted,
  audioTrackPreviewFailed,
  audioTrackPreviewReady,
  audioTrackPreviewStarted,
  selectAudioTracks,
} from "@/app/store/slices/audio-slice";
import { selectSourceMedia, selectSourceSelection } from "@/app/store/slices/source-slice";
import { selectTrim } from "@/app/store/slices/trim-slice";
import type { AppThunk } from "@/app/store/thunks/source-media-thunks";
import {
  audioTrackLoudnessInputsKey,
  audioTrackPreviewProcessing,
  type AudioTrackProcessing,
  type AudioTrackSelection,
  sameAudioTrackPreviewProcessing,
  sameAudioTrackProcessing,
} from "@/domain/audio-processing";
import { analyzeAudioLoudness, detectAudioActivity, prepareAudioPreviews } from "@/lib/tauri/media";
import { normalizeAppError } from "@/lib/tauri/media.utils";

const activeLoudnessAnalysisJobs = new Map<string, Promise<void>>();

function analyzeTrackLoudness(
  streamIndex: number,
  processingOverride?: AudioTrackProcessing,
): AppThunk<Promise<void>> {
  return async (dispatch, getState) => {
    const state = getState();
    const source = selectSourceSelection(state);
    const trim = selectTrim(state);
    const track = selectAudioTracks(state).find((item) => item.streamIndex === streamIndex);
    if (!source || !trim || !track) return;

    const processing = processingOverride ?? track.processing;
    const cacheKey = audioTrackLoudnessInputsKey(source.sourcePath, streamIndex, trim, processing);

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
    const audioTrack = { streamIndex: track.streamIndex, processing: { ...processing } };
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
      track.processing,
    );

    if (
      track.processing.loudnessNormalization !== undefined &&
      (track.loudnessAnalysis.status !== "ready" || track.loudnessAnalysis.cacheKey !== cacheKey)
    ) {
      await dispatch(analyzeTrackLoudness(streamIndex));
      state = getState();
      track = selectAudioTracks(state).find((item) => item.streamIndex === streamIndex);
      trim = selectTrim(state);
      if (!track || !trim) return;
      cacheKey = audioTrackLoudnessInputsKey(
        source.sourcePath,
        streamIndex,
        trim,
        track.processing,
      );
      if (track.loudnessAnalysis.status !== "ready" || track.loudnessAnalysis.cacheKey !== cacheKey)
        return;
    }

    const operationId = crypto.randomUUID();
    const sourceLoadToken = state.source.loadToken;
    const audioTrack = toAudioTrackSelection(track, cacheKey);
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

function prepareTrackPreview(streamIndex: number): AppThunk<Promise<void>> {
  return async (dispatch, getState) => {
    let state = getState();
    const source = selectSourceSelection(state);
    let track = selectAudioTracks(state).find((item) => item.streamIndex === streamIndex);
    if (!source || !track) return;
    let trim = selectTrim(state);
    if (!trim) return;

    const sourceLoadToken = state.source.loadToken;
    const operationId = crypto.randomUUID();
    dispatch(audioTrackPreviewStarted({ operationId, streamIndex }));

    let cacheKey = audioTrackLoudnessInputsKey(
      source.sourcePath,
      streamIndex,
      trim,
      track.processing,
    );

    if (
      track.processing.loudnessNormalization !== undefined &&
      (track.loudnessAnalysis.status !== "ready" || track.loudnessAnalysis.cacheKey !== cacheKey)
    ) {
      await dispatch(analyzeTrackLoudness(streamIndex));
      state = getState();
      track = selectAudioTracks(state).find((item) => item.streamIndex === streamIndex);
      trim = selectTrim(state);
      if (
        !track ||
        !trim ||
        !isCurrentPreviewJob(state, source.sourcePath, sourceLoadToken, streamIndex, operationId)
      )
        return;
      cacheKey = audioTrackLoudnessInputsKey(
        source.sourcePath,
        streamIndex,
        trim,
        track.processing,
      );
      if (
        track.loudnessAnalysis.status === "failed" &&
        track.loudnessAnalysis.cacheKey === cacheKey
      ) {
        dispatch(
          audioTrackPreviewFailed({
            error: track.loudnessAnalysis.error,
            operationId,
            streamIndex,
          }),
        );
        return;
      }
      if (track.loudnessAnalysis.status !== "ready" || track.loudnessAnalysis.cacheKey !== cacheKey)
        return;
    }

    const audioTrack = toAudioTrackPreviewSelection(track, cacheKey);
    try {
      const [descriptor] = await prepareAudioPreviews(source.sourcePath, [audioTrack]);
      if (
        !descriptor ||
        !isCurrentPreviewJob(
          getState(),
          source.sourcePath,
          sourceLoadToken,
          streamIndex,
          operationId,
        ) ||
        !isCurrentTrack(
          getState(),
          source.sourcePath,
          sourceLoadToken,
          audioTrack,
          sameAudioTrackPreviewProcessing,
        )
      )
        return;
      dispatch(audioTrackPreviewReady({ descriptor, operationId }));
    } catch (error: unknown) {
      dispatch(
        audioTrackPreviewFailed({
          error: normalizeAppError(error),
          operationId,
          streamIndex,
        }),
      );
    }
  };
}

function toAudioTrackSelection(
  track: ReturnType<typeof selectAudioTracks>[number],
  cacheKey: string,
): AudioTrackSelection {
  return {
    ...(track.processing.loudnessNormalization !== undefined &&
    track.loudnessAnalysis.status === "ready" &&
    track.loudnessAnalysis.cacheKey === cacheKey
      ? { loudnessAnalysis: { ...track.loudnessAnalysis.value } }
      : {}),
    processing: { ...track.processing },
    streamIndex: track.streamIndex,
  };
}

function toAudioTrackPreviewSelection(
  track: {
    loudnessAnalysis: ReturnType<typeof selectAudioTracks>[number]["loudnessAnalysis"];
    processing: AudioTrackSelection["processing"];
    streamIndex: number;
  },
  cacheKey: string,
): AudioTrackSelection {
  return {
    ...(track.processing.loudnessNormalization !== undefined &&
    track.loudnessAnalysis.status === "ready" &&
    track.loudnessAnalysis.cacheKey === cacheKey
      ? { loudnessAnalysis: { ...track.loudnessAnalysis.value } }
      : {}),
    processing: audioTrackPreviewProcessing(track.processing),
    streamIndex: track.streamIndex,
  };
}

function isCurrentTrack(
  state: ReturnType<Parameters<AppThunk>[1]>,
  sourcePath: string,
  sourceLoadToken: number,
  audioTrack: AudioTrackSelection,
  processingMatches: typeof sameAudioTrackProcessing = sameAudioTrackProcessing,
): boolean {
  const currentTrack = selectAudioTracks(state).find(
    (track) => track.streamIndex === audioTrack.streamIndex,
  );

  const trim = selectTrim(state);
  const loudnessCacheKey = trim
    ? audioTrackLoudnessInputsKey(
        selectSourceSelection(state)?.sourcePath ?? "",
        audioTrack.streamIndex,
        trim,
        audioTrack.processing,
      )
    : null;

  return (
    state.source.loadToken === sourceLoadToken &&
    selectSourceSelection(state)?.sourcePath === sourcePath &&
    currentTrack !== undefined &&
    processingMatches(currentTrack.processing, audioTrack.processing) &&
    (audioTrack.loudnessAnalysis === undefined ||
      (currentTrack.loudnessAnalysis.status === "ready" &&
        currentTrack.loudnessAnalysis.cacheKey === loudnessCacheKey &&
        currentTrack.loudnessAnalysis.value.integratedLufs ===
          audioTrack.loudnessAnalysis.integratedLufs &&
        currentTrack.loudnessAnalysis.value.truePeakDb === audioTrack.loudnessAnalysis.truePeakDb &&
        currentTrack.loudnessAnalysis.value.inputLra === audioTrack.loudnessAnalysis.inputLra &&
        currentTrack.loudnessAnalysis.value.inputThreshold ===
          audioTrack.loudnessAnalysis.inputThreshold))
  );
}

function isCurrentPreviewJob(
  state: ReturnType<Parameters<AppThunk>[1]>,
  sourcePath: string,
  sourceLoadToken: number,
  streamIndex: number,
  operationId: string,
): boolean {
  const track = selectAudioTracks(state).find((candidate) => candidate.streamIndex === streamIndex);
  return (
    state.source.loadToken === sourceLoadToken &&
    selectSourceSelection(state)?.sourcePath === sourcePath &&
    track?.preview.status === "loading" &&
    track.preview.operationId === operationId
  );
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

export { analyzeTrackLoudness, detectTrackActivity, prepareTrackPreview };

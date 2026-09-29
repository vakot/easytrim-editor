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
  type AudioTrackSelection,
  sameAudioTrackPreviewProcessing,
  sameAudioTrackProcessing,
} from "@/domain/audio-processing";
import { analyzeAudioLoudness, detectAudioActivity, prepareAudioPreviews } from "@/lib/tauri/media";
import { normalizeAppError } from "@/lib/tauri/media.utils";

function analyzeTrackLoudness(streamIndex: number): AppThunk<Promise<void>> {
  return async (dispatch, getState) => {
    const state = getState();
    const source = selectSourceSelection(state);
    const trim = selectTrim(state);
    const track = selectAudioTracks(state).find((item) => item.streamIndex === streamIndex);
    if (!source || !trim || !track) return;

    const operationId = crypto.randomUUID();
    const sourceLoadToken = state.source.loadToken;
    const audioTrack = { streamIndex: track.streamIndex, processing: { gainDb: 0 } };
    dispatch(audioTrackLoudnessAnalysisStarted({ operationId, streamIndex }));
    try {
      const result = await analyzeAudioLoudness({
        audioTrack,
        sourcePath: source.sourcePath,
        trim: { startMicros: trim.startMicros, endMicros: trim.endMicros },
      });

      if (!isCurrentAnalysisTrack(getState(), source.sourcePath, sourceLoadToken, streamIndex))
        return;
      dispatch(audioTrackLoudnessAnalysisReady({ operationId, result, streamIndex }));
    } catch (error: unknown) {
      dispatch(
        audioTrackLoudnessAnalysisFailed({
          error: normalizeAppError(error),
          operationId,
          streamIndex,
        }),
      );
    }
  };
}

function detectTrackActivity(streamIndex: number): AppThunk<Promise<void>> {
  return async (dispatch, getState) => {
    const state = getState();
    const source = selectSourceSelection(state);
    const media = selectSourceMedia(state);
    const track = selectAudioTracks(state).find((item) => item.streamIndex === streamIndex);
    if (!source || !media || !track) return;

    const operationId = crypto.randomUUID();
    const sourceLoadToken = state.source.loadToken;
    const audioTrack = toAudioTrackSelection(track);
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
    const state = getState();
    const source = selectSourceSelection(state);
    const track = selectAudioTracks(state).find((item) => item.streamIndex === streamIndex);
    if (!source || !track) return;

    const operationId = crypto.randomUUID();
    const sourceLoadToken = state.source.loadToken;
    const audioTrack = toAudioTrackPreviewSelection(track);
    dispatch(audioTrackPreviewStarted({ operationId, streamIndex }));
    try {
      const [descriptor] = await prepareAudioPreviews(source.sourcePath, [audioTrack]);
      if (
        !descriptor ||
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

function toAudioTrackSelection(track: {
  processing: AudioTrackSelection["processing"];
  streamIndex: number;
}): AudioTrackSelection {
  return { processing: { ...track.processing }, streamIndex: track.streamIndex };
}

function toAudioTrackPreviewSelection(track: {
  processing: AudioTrackSelection["processing"];
  streamIndex: number;
}): AudioTrackSelection {
  return {
    processing: { ...track.processing, gainDb: 0 },
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

  return (
    state.source.loadToken === sourceLoadToken &&
    selectSourceSelection(state)?.sourcePath === sourcePath &&
    currentTrack !== undefined &&
    processingMatches(currentTrack.processing, audioTrack.processing)
  );
}

function isCurrentAnalysisTrack(
  state: ReturnType<Parameters<AppThunk>[1]>,
  sourcePath: string,
  sourceLoadToken: number,
  streamIndex: number,
): boolean {
  return (
    state.source.loadToken === sourceLoadToken &&
    selectSourceSelection(state)?.sourcePath === sourcePath &&
    selectAudioTracks(state).some((track) => track.streamIndex === streamIndex)
  );
}

export { analyzeTrackLoudness, detectTrackActivity, prepareTrackPreview };

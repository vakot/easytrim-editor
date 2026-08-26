import {
  capabilitiesFailed,
  capabilitiesReady,
  selectHasSource,
  selectSourceSelection,
} from "@/app/store/slices/source-slice";
import {
  sourceCleared,
  sourceFailed,
  sourceReady,
  sourceSelected,
} from "@/app/store/actions/source-actions";
import {
  audioPreviewsLoading,
  audioPreviewsReady,
  audioPreviewsUnavailable,
  waveformReady,
  waveformsFailed,
  waveformsLoading,
} from "@/app/store/slices/audio-slice";
import { previewFailed, previewLoading, previewReady } from "@/app/store/slices/preview-slice";
import {
  dropListenerErrorCleared,
  nativeDialogStateChanged,
  sourceChoiceFinished,
  sourceChoiceStarted,
} from "@/app/store/slices/import-workflow-slice";
import {
  checkMediaCapabilities,
  chooseSource as chooseSourceDialog,
  inspectMedia,
  normalizeAppError,
  prepareAudioPreviews,
  prepareProxyPreview,
  prepareSourcePreview,
  prepareWaveforms,
  type AppError,
  type PreviewKind,
} from "@/lib/tauri/media";
import type { SourceRef } from "@/domain/source";
import type { AppDispatch, RootState } from "@/app/store/store";

export type AppThunk<ReturnValue = void | Promise<unknown>> = (
  dispatch: AppDispatch,
  getState: () => RootState,
) => ReturnValue;

let waveformJobSequence = 0;
let sourceLoadSequence = 0;

function isCurrentSource(state: RootState, sourcePath: string, loadToken: number): boolean {
  return (
    selectSourceSelection(state)?.sourcePath === sourcePath && state.source.loadToken === loadToken
  );
}

function isSourceInspectionError(error: AppError): boolean {
  return ["probe_failed", "unsupported_media", "io_failed", "source_replaced"].includes(error.code);
}

export const checkMediaCapabilitiesRequested = (): AppThunk => async (dispatch) => {
  try {
    dispatch(capabilitiesReady(await checkMediaCapabilities()));
  } catch (error: unknown) {
    dispatch(capabilitiesFailed(normalizeAppError(error)));
  }
};

export const importSource =
  (source: SourceRef, mergeAudio?: boolean): AppThunk =>
  async (dispatch, getState) => {
    const selectedMergeAudio = mergeAudio ?? getState().preferences.mergeAudioEnabledDefault;
    const loadToken = ++sourceLoadSequence;
    dispatch(dropListenerErrorCleared());
    dispatch(sourceSelected({ source, mergeAudio: selectedMergeAudio, loadToken }));

    let media;
    try {
      media = await inspectMedia(source.sourcePath);
    } catch (error: unknown) {
      const normalized = normalizeAppError(error);
      if (isCurrentSource(getState(), source.sourcePath, loadToken)) {
        dispatch(sourceFailed({ loadToken, error: normalized }));
      }
      return;
    }

    if (!isCurrentSource(getState(), source.sourcePath, loadToken)) return;
    dispatch(sourceReady({ loadToken, media }));

    const audioStreamIndexes = media.audioStreams.map((stream) => stream.streamIndex);
    const audioPreparation =
      audioStreamIndexes.length <= 1
        ? Promise.resolve().then(() => {
            if (isCurrentSource(getState(), source.sourcePath, loadToken)) {
              dispatch(audioPreviewsReady({ previews: [] }));
            }
          })
        : (async () => {
            dispatch(audioPreviewsLoading());
            try {
              const previews = await prepareAudioPreviews(source.sourcePath, audioStreamIndexes);
              if (isCurrentSource(getState(), source.sourcePath, loadToken)) {
                dispatch(audioPreviewsReady({ previews }));
              }
            } catch (error: unknown) {
              if (isCurrentSource(getState(), source.sourcePath, loadToken)) {
                dispatch(
                  audioPreviewsUnavailable({
                    error: normalizeAppError(error),
                  }),
                );
              }
            }
          })();

    dispatch(previewLoading({ kind: "source" }));
    const previewPreparation = (async () => {
      try {
        const preview = await prepareSourcePreview(source.sourcePath);
        if (isCurrentSource(getState(), source.sourcePath, loadToken)) {
          dispatch(previewReady({ preview }));
        }
      } catch (error: unknown) {
        const normalized = normalizeAppError(error);
        if (!isCurrentSource(getState(), source.sourcePath, loadToken)) return;
        dispatch(
          isSourceInspectionError(normalized)
            ? sourceFailed({ loadToken, error: normalized })
            : previewFailed({ error: normalized }),
        );
      }
    })();

    await Promise.all([audioPreparation, previewPreparation]);
  };

export const chooseSourceRequested = (): AppThunk => async (dispatch, getState) => {
  if (getState().importWorkflow.isChoosingSource || getState().importWorkflow.isNativeDialogOpen) {
    return;
  }

  dispatch(sourceChoiceStarted());
  let source: SourceRef | null = null;
  let pickerError: AppError | null = null;

  try {
    source = await chooseSourceDialog();
  } catch (error: unknown) {
    pickerError = normalizeAppError(error);
  } finally {
    // The native picker has resolved here. Import inspection and dependent media
    // preparation must not extend the native-dialog workflow state.
    dispatch(sourceChoiceFinished());
  }

  if (pickerError) {
    dispatch(sourceFailed({ error: pickerError }));
    return;
  }

  if (source) {
    await dispatch(importSource(source));
  }
};

export const closeSourceRequested = (): AppThunk<void> => (dispatch, getState) => {
  if (!selectHasSource(getState())) return;
  dispatch(sourceCleared());
  dispatch(nativeDialogStateChanged(false));
};

export const handlePreviewPlaybackError =
  (sourcePath: string, previewKind: PreviewKind): AppThunk =>
  async (dispatch, getState) => {
    const loadToken = getState().source.loadToken;
    if (!isCurrentSource(getState(), sourcePath, loadToken)) return;
    if (previewKind === "proxy") {
      dispatch(
        previewFailed({
          error: {
            code: "preview_playback_failed",
            message: "The compatible preview could not be played.",
          },
        }),
      );
      return;
    }

    dispatch(previewLoading({ kind: "proxy" }));
    try {
      const preview = await prepareProxyPreview(sourcePath);
      if (isCurrentSource(getState(), sourcePath, loadToken)) {
        dispatch(previewReady({ preview }));
      }
    } catch (error: unknown) {
      if (isCurrentSource(getState(), sourcePath, loadToken)) {
        dispatch(previewFailed({ error: normalizeAppError(error) }));
      }
    }
  };

export const prepareSourceWaveforms =
  (sourcePath: string, streamIndexes: number[], width: number): AppThunk<Promise<string | null>> =>
  async (dispatch, getState) => {
    const loadToken = getState().source.loadToken;
    if (streamIndexes.length === 0 || !isCurrentSource(getState(), sourcePath, loadToken))
      return null;

    const jobId = `waveform-${++waveformJobSequence}`;
    dispatch(waveformsLoading({ jobId, width, streamIndexes }));
    try {
      const results = await prepareWaveforms(sourcePath, jobId, streamIndexes, width);
      if (isCurrentSource(getState(), sourcePath, loadToken)) {
        results.forEach((result) => dispatch(waveformReady(result)));
      }
    } catch (error: unknown) {
      if (isCurrentSource(getState(), sourcePath, loadToken)) {
        dispatch(
          waveformsFailed({
            jobId,
            width,
            streamIndexes,
            error: normalizeAppError(error),
          }),
        );
      }
    }
    return jobId;
  };

import {
  capabilitiesFailed,
  capabilitiesReady,
  audioPreviewsLoading,
  audioPreviewsReady,
  audioPreviewsUnavailable,
  previewFailed,
  previewLoading,
  previewReady,
  selectActiveSource,
  sourceCleared,
  sourceFailed,
  sourceReady,
  sourceSelected,
  waveformReady,
  waveformsFailed,
  waveformsLoading,
} from "@/app/store/slices/session-slice";
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
  type SourceSelection,
} from "@/lib/tauri/media";
import type { AppDispatch, RootState } from "@/app/store/store";

export type AppThunk<ReturnValue = Promise<void>> = (
  dispatch: AppDispatch,
  getState: () => RootState,
) => ReturnValue;

let waveformJobSequence = 0;

function isCurrentSource(state: RootState, sourceId: string): boolean {
  return selectActiveSource(state)?.selection.sourceId === sourceId;
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
  (source: SourceSelection, mergeAudio?: boolean): AppThunk =>
  async (dispatch, getState) => {
    const selectedMergeAudio = mergeAudio ?? getState().preferences.toolDefaults.mergeAudioEnabled;
    dispatch(dropListenerErrorCleared());
    dispatch(sourceSelected({ source, mergeAudio: selectedMergeAudio }));

    let media;
    try {
      media = await inspectMedia(source.sourceId);
    } catch (error: unknown) {
      const normalized = normalizeAppError(error);
      if (isCurrentSource(getState(), source.sourceId)) {
        dispatch(sourceFailed({ sourceId: source.sourceId, error: normalized }));
      }
      return;
    }

    if (!isCurrentSource(getState(), source.sourceId)) return;
    dispatch(sourceReady({ sourceId: source.sourceId, media }));

    const audioStreamIndexes = media.audioStreams.map((stream) => stream.streamIndex);
    const audioPreparation =
      audioStreamIndexes.length <= 1
        ? Promise.resolve().then(() => {
            if (isCurrentSource(getState(), source.sourceId)) {
              dispatch(audioPreviewsReady({ sourceId: source.sourceId, previews: [] }));
            }
          })
        : (async () => {
            dispatch(audioPreviewsLoading({ sourceId: source.sourceId }));
            try {
              const previews = await prepareAudioPreviews(source.sourceId, audioStreamIndexes);
              if (isCurrentSource(getState(), source.sourceId)) {
                dispatch(audioPreviewsReady({ sourceId: source.sourceId, previews }));
              }
            } catch (error: unknown) {
              if (isCurrentSource(getState(), source.sourceId)) {
                dispatch(
                  audioPreviewsUnavailable({
                    sourceId: source.sourceId,
                    error: normalizeAppError(error),
                  }),
                );
              }
            }
          })();

    dispatch(previewLoading({ sourceId: source.sourceId, kind: "source" }));
    const previewPreparation = (async () => {
      try {
        const preview = await prepareSourcePreview(source.sourceId);
        if (isCurrentSource(getState(), source.sourceId)) {
          dispatch(previewReady({ sourceId: source.sourceId, preview }));
        }
      } catch (error: unknown) {
        const normalized = normalizeAppError(error);
        if (!isCurrentSource(getState(), source.sourceId)) return;
        dispatch(
          isSourceInspectionError(normalized)
            ? sourceFailed({ sourceId: source.sourceId, error: normalized })
            : previewFailed({ sourceId: source.sourceId, error: normalized }),
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
  try {
    const source = await chooseSourceDialog();
    if (source) {
      await dispatch(importSource(source));
    }
  } catch (error: unknown) {
    dispatch(sourceFailed({ error: normalizeAppError(error) }));
  } finally {
    dispatch(sourceChoiceFinished());
  }
};

export const closeSourceRequested = (): AppThunk<void> => (dispatch, getState) => {
  if (!selectActiveSource(getState())) return;
  dispatch(sourceCleared());
  dispatch(nativeDialogStateChanged(false));
};

export const handlePreviewPlaybackError =
  (sourceId: string, previewKind: PreviewKind): AppThunk =>
  async (dispatch, getState) => {
    if (!isCurrentSource(getState(), sourceId)) return;
    if (previewKind === "proxy") {
      dispatch(
        previewFailed({
          sourceId,
          error: {
            code: "preview_playback_failed",
            message: "The compatible preview could not be played.",
          },
        }),
      );
      return;
    }

    dispatch(previewLoading({ sourceId, kind: "proxy" }));
    try {
      const preview = await prepareProxyPreview(sourceId);
      if (isCurrentSource(getState(), sourceId)) {
        dispatch(previewReady({ sourceId, preview }));
      }
    } catch (error: unknown) {
      if (isCurrentSource(getState(), sourceId)) {
        dispatch(previewFailed({ sourceId, error: normalizeAppError(error) }));
      }
    }
  };

export const prepareSourceWaveforms =
  (sourceId: string, streamIndexes: number[], width: number): AppThunk<Promise<string | null>> =>
  async (dispatch, getState) => {
    if (streamIndexes.length === 0 || !isCurrentSource(getState(), sourceId)) return null;

    const jobId = `waveform-${++waveformJobSequence}`;
    dispatch(waveformsLoading({ sourceId, jobId, width, streamIndexes }));
    try {
      const results = await prepareWaveforms(sourceId, jobId, streamIndexes, width);
      if (isCurrentSource(getState(), sourceId)) {
        results.forEach((result) => dispatch(waveformReady(result)));
      }
    } catch (error: unknown) {
      if (isCurrentSource(getState(), sourceId)) {
        dispatch(
          waveformsFailed({
            sourceId,
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

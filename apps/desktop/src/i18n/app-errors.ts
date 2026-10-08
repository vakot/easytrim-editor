import type { TFunction } from "i18next";

import type { AppError } from "@/domain/media";

function localizeAppError(error: AppError, t: TFunction): string {
  switch (error.messageId) {
    case "internal.unexpected":
      return t("app.errors.unexpected");
    case "source.replaced":
      return t("source.errors.replaced");
    case "export.fileLocationCouldNotBeOpened":
      return t("export.errors.fileLocationCouldNotBeOpened");
    case "export.ffmpegCouldNotBeStarted":
      return t("export.errors.ffmpegCouldNotBeStarted");
    case "source.fileCouldNotBeMovedToTrash":
      return t("source.errors.fileCouldNotBeMovedToTrash");
    case "source.trashCouldNotBeRead":
      return t("source.errors.trashCouldNotBeRead");
    case "source.fileCouldNotBeRestoredFromTrash":
      return t("source.errors.fileCouldNotBeRestoredFromTrash");
    case "media.thumbnail.ffmpegRequired":
      return t("source.errors.thumbnail.ffmpegRequired");
    case "media.thumbnail.preparationTimedOut":
      return t("source.errors.thumbnail.preparationTimedOut");
    case "media.thumbnail.preparationFailed":
      return t("source.errors.thumbnail.preparationFailed");
    case "media.waveform.widthOutOfRange": {
      const minWidth = getNonNegativeIntegerArg(error, "minWidth");
      const maxWidth = getNonNegativeIntegerArg(error, "maxWidth");
      if (minWidth === undefined || maxWidth === undefined || maxWidth <= minWidth) {
        return t("app.errors.unexpected");
      }
      return t("audio.errors.waveform.widthOutOfRange", {
        minWidth,
        maxWidth,
      });
    }
    case "media.waveform.streamDoesNotBelongToSource": {
      const streamIndex = getNonNegativeIntegerArg(error, "streamIndex");
      if (streamIndex === undefined) return t("app.errors.unexpected");
      return t("audio.errors.waveform.streamDoesNotBelongToSource", {
        streamIndex,
      });
    }
    case "media.waveform.analysisFailed": {
      const streamIndex = getNonNegativeIntegerArg(error, "streamIndex");
      if (streamIndex === undefined) return t("app.errors.unexpected");
      return t("audio.errors.waveform.analysisFailed", {
        streamIndex,
      });
    }
    case "media.waveform.sampleCountUnavailable": {
      const streamIndex = getNonNegativeIntegerArg(error, "streamIndex");
      if (streamIndex === undefined) return t("app.errors.unexpected");
      return t("audio.errors.waveform.sampleCountUnavailable", {
        streamIndex,
      });
    }
    case "media.waveform.tooFewSamples": {
      const streamIndex = getNonNegativeIntegerArg(error, "streamIndex");
      if (streamIndex === undefined) return t("app.errors.unexpected");
      return t("audio.errors.waveform.tooFewSamples", {
        streamIndex,
      });
    }
    case "media.waveform.sampleReductionFailed": {
      const streamIndex = getNonNegativeIntegerArg(error, "streamIndex");
      if (streamIndex === undefined) return t("app.errors.unexpected");
      return t("audio.errors.waveform.sampleReductionFailed", {
        streamIndex,
      });
    }
    case "media.waveform.imageMissing": {
      const streamIndex = getNonNegativeIntegerArg(error, "streamIndex");
      if (streamIndex === undefined) return t("app.errors.unexpected");
      return t("audio.errors.waveform.imageMissing", {
        streamIndex,
      });
    }
    case "media.waveform.imageRenderingFailed": {
      const streamIndex = getNonNegativeIntegerArg(error, "streamIndex");
      if (streamIndex === undefined) return t("app.errors.unexpected");
      return t("audio.errors.waveform.imageRenderingFailed", {
        streamIndex,
      });
    }
    case "source.dropVideoFileInsteadOfEmptySelection":
      return t("source.errors.dropVideoFileInsteadOfEmptySelection");
    case "export.analyzeTrackLoudnessToContinue":
      return t("export.errors.analyzeTrackLoudnessToContinue");
    case "export.audioTrackIsRequired":
      return t("export.errors.audioTrackIsRequired");
    case "export.audioOutputFormatIsInvalid":
      return t("export.errors.audioOutputFormatIsInvalid");
    case "export.wavRequiresMergedAudioTracks":
      return t("export.errors.wavRequiresMergedAudioTracks");
    case "media.audio.analyzeTrackLoudnessToPrepareAudioPlayback":
      return t("audio.errors.audio.analyzeTrackLoudnessToPrepareAudioPlayback");
    case "source.selectedSourceCouldNotBeRestored":
      return t("source.errors.selectedSourceCouldNotBeRestored");
    case "source.cannotDeleteWhileExportIsQueuedOrRendering":
      return t("source.errors.cannotDeleteWhileExportIsQueuedOrRendering");
    case "media.preview.compatiblePreviewCouldNotBePlayed":
      return t("preview.errors.compatiblePreviewCouldNotBePlayed");
    case "media.waveform.previewCouldNotBeDisplayed":
      return t("audio.errors.waveform.previewCouldNotBeDisplayed");
    case "export.interruptedWhenEasyTrimClosedUnexpectedly":
      return t("export.errors.interruptedWhenEasyTrimClosedUnexpectedly");
    case "diagnostics.diagnosticEventNameIsInvalid":
      return t("app.errors.diagnostics.diagnosticEventNameIsInvalid");
    case "diagnostics.diagnosticLevelIsInvalid":
      return t("app.errors.diagnostics.diagnosticLevelIsInvalid");
    case "diagnostics.diagnosticLogsPathIsInvalid":
      return t("app.errors.diagnostics.diagnosticLogsPathIsInvalid");
    case "diagnostics.diagnosticReportIsUnavailable":
      return t("app.errors.diagnostics.diagnosticReportIsUnavailable");
    case "diagnostics.diagnosticReportPathIsInvalid":
      return t("app.errors.diagnostics.diagnosticReportPathIsInvalid");
    case "diagnostics.diagnosticSessionIdentifierIsInvalid":
      return t("app.errors.diagnostics.diagnosticSessionIdentifierIsInvalid");
    case "export.audioStreamSelectionOrProcessingSettingIsInvalid":
      return t("export.errors.audioStreamSelectionOrProcessingSettingIsInvalid");
    case "export.cropSelectionIsInvalid":
      return t("export.errors.cropSelectionIsInvalid");
    case "export.exportWasCancelled":
      return t("export.errors.exportWasCancelled");
    case "export.fastCutCannotApplyRotationUseOptimizedRender":
      return t("export.errors.fastExportCannotApplyRotationUseOptimizedExport");
    case "export.ffmpegCouldNotRenderTheSelectedSegment":
      return t("export.errors.ffmpegCouldNotRenderTheSelectedSegment");
    case "export.ffmpegIsRequiredToExportVideoFiles":
      return t("export.errors.ffmpegIsRequiredToExportVideoFiles");
    case "export.fileOrFolderIsNoLongerAvailable":
      return t("export.errors.fileOrFolderIsNoLongerAvailable");
    case "export.finalOptimizedFfmpegOptionIsMissingItsValue":
      return t("export.errors.finalOptimizedFfmpegOptionIsMissingItsValue");
    case "export.inspectTheVideoBeforeExporting":
      return t("export.errors.inspectTheVideoBeforeExporting");
    case "export.optimizedArgumentsCannotOverrideInputTrimMappingFiltersOutputFormatOrOutputPaths":
      return t(
        "export.errors.optimizedArgumentsCannotOverrideInputTrimMappingFiltersOutputFormatOrOutputPaths",
      );
    case "export.optimizedFfmpegArgumentsContainAnUnclosedQuote":
      return t("export.errors.optimizedFfmpegArgumentsContainAnUnclosedQuote");
    case "export.outputFrameRateIsInvalid":
      return t("export.errors.outputFrameRateIsInvalid");
    case "export.outputNameIsRequired":
      return t("export.errors.outputNameIsRequired");
    case "export.outputResolutionMustBeGreaterThanZero":
      return t("export.errors.outputResolutionMustBeGreaterThanZero");
    case "export.renderedOutputCouldNotBeVerified":
      return t("export.errors.renderedOutputCouldNotBeVerified");
    case "export.renderedOutputIsEmpty":
      return t("export.errors.renderedOutputIsEmpty");
    case "export.rotationMustBe090180Or270Degrees":
      return t("export.errors.rotationMustBe090180Or270Degrees");
    case "export.selectedExportRangeIsInvalid":
      return t("export.errors.selectedExportRangeIsInvalid");
    case "export.selectedOutputLocationIsNotSupported":
      return t("export.errors.selectedOutputLocationIsNotSupported");
    case "frame.capturedFrameCouldNotBeSaved":
      return t("preview.errors.frame.capturedFrameCouldNotBeSaved");
    case "frame.capturedFrameIsNotAPngImage":
      return t("preview.errors.frame.capturedFrameIsNotAPngImage");
    case "frame.capturedFrameIsTooLargeToSave":
      return t("preview.errors.frame.capturedFrameIsTooLargeToSave");
    case "frame.selectedImageLocationIsNotSupported":
      return t("preview.errors.frame.selectedImageLocationIsNotSupported");
    case "frame.suggestedFrameFilenameIsInvalid":
      return t("preview.errors.frame.suggestedFrameFilenameIsInvalid");
    case "media.audio.audioPreviewsRequireInspectedSourceMedia":
      return t("audio.errors.audio.audioPreviewsRequireInspectedSourceMedia");
    case "media.audio.ffmpegCouldNotPrepareAudioPreview":
      return t("audio.errors.audio.ffmpegCouldNotPrepareAudioPreview");
    case "media.audio.ffmpegIsRequiredToPrepareAudioPreview":
      return t("audio.errors.audio.ffmpegIsRequiredToPrepareAudioPreview");
    case "media.audio.preparingAudioPreviewTookTooLong":
      return t("audio.errors.audio.preparingAudioPreviewTookTooLong");
    case "media.audio.selectedAudioStreamsCouldNotBePreparedForPreview":
      return t("audio.errors.audio.selectedAudioStreamsCouldNotBePreparedForPreview");
    case "media.audio.temporaryAudioPreviewDirectoryCouldNotBeCreated":
      return t("audio.errors.audio.temporaryAudioPreviewDirectoryCouldNotBeCreated");
    case "media.audio.uniqueTemporaryAudioPreviewDirectoryCouldNotBeCreated":
      return t("audio.errors.audio.uniqueTemporaryAudioPreviewDirectoryCouldNotBeCreated");
    case "media.audioActivity.audioActivityAnalysisContainsTooManyRanges":
      return t("audio.activityDetection.errors.audioActivityAnalysisContainsTooManyRanges");
    case "media.audioActivity.audioActivityAnalysisOutputExceededItsSafetyLimit":
      return t("audio.activityDetection.errors.audioActivityAnalysisOutputExceededItsSafetyLimit");
    case "media.audioActivity.audioActivityDetectionTookTooLong":
      return t("audio.activityDetection.errors.audioActivityDetectionTookTooLong");
    case "media.audioActivity.audioActivityDetectionWasInterrupted":
      return t("audio.activityDetection.errors.audioActivityDetectionWasInterrupted");
    case "media.audioActivity.ffmpegCouldNotAnalyzeAudioActivity":
      return t("audio.activityDetection.errors.ffmpegCouldNotAnalyzeAudioActivity");
    case "media.audioActivity.ffmpegIsRequiredToAnalyzeAudioActivity":
      return t("audio.activityDetection.errors.ffmpegIsRequiredToAnalyzeAudioActivity");
    case "media.audioActivity.inspectTheVideoBeforeDetectingAudioActivity":
      return t("audio.activityDetection.errors.inspectVideoBeforeDetectingAudioActivity");
    case "media.audioPreviewStreamIndexesMustBeUnique":
      return t("audio.errors.audioPreviewStreamIndexesMustBeUnique");
    case "media.audioStreamMetadataIsUnavailableForWaveformGeneration":
      return t("audio.errors.audioStreamMetadataIsUnavailableForWaveformGeneration");
    case "media.inspectTheVideoBeforeDetectingAudioActivity":
      return t("audio.activityDetection.errors.inspectVideoBeforeDetectingAudioActivity");
    case "media.loudness.ffmpegCouldNotAnalyzeAudioLoudness":
      return t("audio.errors.loudness.ffmpegCouldNotAnalyzeAudioLoudness");
    case "media.loudness.ffmpegDidNotReturnLoudnessMeasurements":
      return t("audio.errors.loudness.ffmpegDidNotReturnLoudnessMeasurements");
    case "media.loudness.ffmpegIsRequiredToAnalyzeLoudness":
      return t("audio.errors.loudness.ffmpegIsRequiredToAnalyzeLoudness");
    case "media.loudness.ffmpegReturnedIncompleteLoudnessMeasurements":
      return t("audio.errors.loudness.ffmpegReturnedIncompleteLoudnessMeasurements");
    case "media.loudness.ffmpegReturnedInvalidLoudnessMeasurements":
      return t("audio.errors.loudness.ffmpegReturnedInvalidLoudnessMeasurements");
    case "media.loudness.inspectTheVideoBeforeAnalyzingAudio":
      return t("audio.errors.loudness.inspectTheVideoBeforeAnalyzingAudio");
    case "media.loudness.loudnessAnalysisOutputExceededItsSafetyLimit":
      return t("audio.errors.loudness.loudnessAnalysisOutputExceededItsSafetyLimit");
    case "media.loudness.loudnessAnalysisTookTooLong":
      return t("audio.errors.loudness.loudnessAnalysisTookTooLong");
    case "media.loudness.loudnessAnalysisWasInterrupted":
      return t("audio.errors.loudness.loudnessAnalysisWasInterrupted");
    case "media.preview.compatiblePreviewCouldNotBePreparedForThisVideo":
      return t("preview.errors.compatiblePreviewCouldNotBePreparedForThisVideo");
    case "media.preview.ffmpegCouldNotPrepareACompatiblePreview":
      return t("preview.errors.ffmpegCouldNotPrepareACompatiblePreview");
    case "media.preview.ffmpegIsRequiredToPrepareACompatiblePreview":
      return t("preview.errors.ffmpegIsRequiredToPrepareACompatiblePreview");
    case "media.preview.inspectTheVideoBeforePreparingItsPreview":
      return t("preview.errors.inspectTheVideoBeforePreparingItsPreview");
    case "media.preview.preparingTheCompatiblePreviewTookTooLong":
      return t("preview.errors.preparingTheCompatiblePreviewTookTooLong");
    case "media.preview.temporaryPreviewDirectoryCouldNotBeCreated":
      return t("preview.errors.temporaryPreviewDirectoryCouldNotBeCreated");
    case "media.preview.uniqueTemporaryPreviewDirectoryCouldNotBeCreated":
      return t("preview.errors.uniqueTemporaryPreviewDirectoryCouldNotBeCreated");
    case "media.probe.ffprobeCouldNotBeStarted":
      return t("source.errors.probe.ffprobeCouldNotBeStarted");
    case "media.probe.ffprobeCouldNotInspectThisVideo":
      return t("source.errors.probe.ffprobeCouldNotInspectThisVideo");
    case "media.probe.ffprobeIsRequiredToInspectVideoFiles":
      return t("source.errors.probe.ffprobeIsRequiredToInspectVideoFiles");
    case "media.probe.ffprobeReturnedUnreadableMetadata":
      return t("source.errors.probe.ffprobeReturnedUnreadableMetadata");
    case "media.probe.noUsableVideoStreamWasFound":
      return t("source.errors.probe.noUsableVideoStreamWasFound");
    case "media.probe.videoContainsMoreMetadataThanTheInspectionLimitAllows":
      return t("source.errors.probe.videoContainsMoreMetadataThanTheInspectionLimitAllows");
    case "media.probe.videoDurationIsUnavailable":
      return t("source.errors.probe.videoDurationIsUnavailable");
    case "media.probe.videoHeightIsUnavailable":
      return t("source.errors.probe.videoHeightIsUnavailable");
    case "media.probe.videoInspectionExceededThe20SecondLimit":
      return t("source.errors.probe.videoInspectionExceededThe20SecondLimit");
    case "media.probe.videoWidthIsUnavailable":
      return t("source.errors.probe.videoWidthIsUnavailable");
    case "media.scene.activeSourceHasNotBeenInspected":
      return t("timeline.errors.scene.activeSourceHasNotBeenInspected");
    case "media.scene.ffmpegCouldNotDetectSceneChanges":
      return t("timeline.errors.scene.ffmpegCouldNotDetectSceneChanges");
    case "media.scene.ffmpegIsRequiredToDetectSceneChanges":
      return t("timeline.errors.scene.ffmpegIsRequiredToDetectSceneChanges");
    case "media.scene.sceneDetectionOutputExceededItsSafetyLimit":
      return t("timeline.errors.scene.sceneDetectionOutputExceededItsSafetyLimit");
    case "media.scene.sceneDetectionTookTooLong":
      return t("timeline.errors.scene.sceneDetectionTookTooLong");
    case "media.scene.sceneDetectionWasInterrupted":
      return t("timeline.errors.scene.sceneDetectionWasInterrupted");
    case "media.scene.sourceContainsTooManyDetectedSceneChanges":
      return t("timeline.errors.scene.sourceContainsTooManyDetectedSceneChanges");
    case "media.selectBetweenOneAnd32AudioStreamsForPreview":
      return t("audio.errors.selectBetweenOneAnd32AudioStreamsForPreview");
    case "media.selectBetweenOneAnd32AudioStreamsForWaveformGeneration":
      return t("audio.errors.selectBetweenOneAnd32AudioStreamsForWaveformGeneration");
    case "media.thumbnail.sourceFileIsNoLongerAvailable":
      return t("source.errors.thumbnail.sourceFileIsNoLongerAvailable");
    case "media.thumbnail.sourceFileMetadataIsUnavailable":
      return t("source.errors.thumbnail.sourceFileMetadataIsUnavailable");
    case "media.thumbnail.temporaryThumbnailDirectoryCouldNotBeCreated":
      return t("source.errors.thumbnail.temporaryThumbnailDirectoryCouldNotBeCreated");
    case "media.thumbnail.thumbnailCouldNotBeEncoded":
      return t("source.errors.thumbnail.thumbnailCouldNotBeEncoded");
    case "media.thumbnail.thumbnailCouldNotBePreparedForThisVideo":
      return t("source.errors.thumbnail.thumbnailCouldNotBePreparedForThisVideo");
    case "media.thumbnail.thumbnailCouldNotBeSavedTemporarily":
      return t("source.errors.thumbnail.thumbnailCouldNotBeSavedTemporarily");
    case "media.thumbnail.uniqueTemporaryThumbnailDirectoryCouldNotBeCreated":
      return t("source.errors.thumbnail.uniqueTemporaryThumbnailDirectoryCouldNotBeCreated");
    case "media.thumbnailCacheIsUnavailable":
      return t("audio.errors.thumbnailCacheIsUnavailable");
    case "media.waveform.ffmpegCouldNotGenerateTheAudioWaveform":
      return t("audio.errors.waveform.ffmpegCouldNotGenerateTheAudioWaveform");
    case "media.waveform.ffmpegIsRequiredToGenerateAudioWaveforms":
      return t("audio.errors.waveform.ffmpegIsRequiredToGenerateAudioWaveforms");
    case "media.waveform.temporaryWaveformDirectoryCouldNotBeCreated":
      return t("audio.errors.waveform.temporaryWaveformDirectoryCouldNotBeCreated");
    case "media.waveform.uniqueTemporaryWaveformDirectoryCouldNotBeCreated":
      return t("audio.errors.waveform.uniqueTemporaryWaveformDirectoryCouldNotBeCreated");
    case "media.waveform.waveformGenerationTookTooLong":
      return t("audio.errors.waveform.waveformGenerationTookTooLong");
    case "media.waveform.waveformGenerationWasReplaced":
      return t("audio.errors.waveform.waveformGenerationWasReplaced");
    case "media.waveformProcessingSettingsMustMatchTheSelectedAudioStreams":
      return t("audio.errors.waveformProcessingSettingsMustMatchTheSelectedAudioStreams");
    case "media.waveformStreamIndexesMustBeUnique":
      return t("audio.errors.waveformStreamIndexesMustBeUnique");
    case "queue.selectedSystemActionCouldNotBeStarted":
      return t("queue.errors.selectedSystemActionCouldNotBeStarted");
    case "queue.selectedSystemActionWasRejectedByTheSystem":
      return t("queue.errors.selectedSystemActionWasRejectedByTheSystem");
    case "queue.systemShutdownIsNotAvailable":
      return t("queue.errors.systemShutdownIsNotAvailable");
    case "queue.systemSleepIsNotAvailable":
      return t("queue.errors.systemSleepIsNotAvailable");
    case "source.fileTypeIsNotSupportedYet":
      return t("source.errors.fileTypeIsNotSupportedYet");
    case "source.restoringSourceFilesFromTrashIsNotSupportedOnThisPlatform":
      return t("source.errors.restoringSourceFilesFromTrashIsNotSupportedOnThisPlatform");
    case "source.selectAVideoFileInsteadOfAFolder":
      return t("source.errors.selectAVideoFileInsteadOfAFolder");
    case "source.selectedSourceHasNoUsableFileName":
      return t("source.errors.selectedSourceHasNoUsableFileName");
    case "source.selectedSourceLocationIsNotSupported":
      return t("source.errors.selectedSourceLocationIsNotSupported");
    case "source.selectedVideoCouldNotBeOpened":
      return t("source.errors.selectedVideoCouldNotBeOpened");
    case "source.selectedVideoHasNoUsableFileName":
      return t("source.errors.selectedVideoHasNoUsableFileName");
    case "source.sourceFileCouldNotBeFoundInTrash":
      return t("source.errors.sourceFileCouldNotBeFoundInTrash");
    case "source.sourcePathMustBeAbsolute":
      return t("source.errors.sourcePathMustBeAbsolute");
    case "state.audioPreviewIsNotAvailable":
      return t("app.errors.state.audioPreviewIsNotAvailable");
    case "state.operationIsNoLongerAvailable":
      return t("app.errors.state.operationIsNoLongerAvailable");
    case "state.outputLocationIsNoLongerAvailable":
      return t("app.errors.state.outputLocationIsNoLongerAvailable");
    case "state.waveformIsNotAvailable":
      return t("app.errors.state.waveformIsNotAvailable");
    case "state.waveformJobIdIsInvalid":
      return t("app.errors.state.waveformJobIdIsInvalid");
    default:
      return t("app.errors.unexpected");
  }
}

function getNonNegativeIntegerArg(error: AppError, key: string): number | undefined {
  const value = error.messageArgs?.[key];
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}

export { localizeAppError };

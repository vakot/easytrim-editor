use std::collections::BTreeMap;

use serde::Serialize;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
pub enum AppErrorMessageId {
    #[serde(rename = "internal.unexpected")]
    InternalUnexpected,
    #[serde(rename = "export.fileLocationCouldNotBeOpened")]
    ExportFileLocationCouldNotBeOpened,
    #[serde(rename = "export.ffmpegCouldNotBeStarted")]
    ExportFfmpegCouldNotBeStarted,
    #[serde(rename = "source.fileCouldNotBeMovedToTrash")]
    SourceFileCouldNotBeMovedToTrash,
    #[serde(rename = "source.trashCouldNotBeRead")]
    SourceTrashCouldNotBeRead,
    #[serde(rename = "source.fileCouldNotBeRestoredFromTrash")]
    SourceFileCouldNotBeRestoredFromTrash,
    #[serde(rename = "media.waveform.widthOutOfRange")]
    MediaWaveformWidthOutOfRange,
    #[serde(rename = "media.waveform.streamDoesNotBelongToSource")]
    MediaWaveformStreamDoesNotBelongToSource,
    #[serde(rename = "media.waveform.analysisFailed")]
    MediaWaveformAnalysisFailed,
    #[serde(rename = "media.waveform.sampleCountUnavailable")]
    MediaWaveformSampleCountUnavailable,
    #[serde(rename = "media.waveform.tooFewSamples")]
    MediaWaveformTooFewSamples,
    #[serde(rename = "media.waveform.sampleReductionFailed")]
    MediaWaveformSampleReductionFailed,
    #[serde(rename = "media.waveform.imageMissing")]
    MediaWaveformImageMissing,
    #[serde(rename = "media.waveform.imageRenderingFailed")]
    MediaWaveformImageRenderingFailed,
    #[serde(rename = "media.thumbnail.ffmpegRequired")]
    MediaThumbnailFfmpegRequired,
    #[serde(rename = "media.thumbnail.preparationTimedOut")]
    MediaThumbnailPreparationTimedOut,
    #[serde(rename = "media.thumbnail.preparationFailed")]
    MediaThumbnailPreparationFailed,
    #[serde(rename = "diagnostics.diagnosticEventNameIsInvalid")]
    DiagnosticsDiagnosticEventNameIsInvalid,
    #[serde(rename = "diagnostics.diagnosticLevelIsInvalid")]
    DiagnosticsDiagnosticLevelIsInvalid,
    #[serde(rename = "diagnostics.diagnosticLogsPathIsInvalid")]
    DiagnosticsDiagnosticLogsPathIsInvalid,
    #[serde(rename = "diagnostics.diagnosticReportPathIsInvalid")]
    DiagnosticsDiagnosticReportPathIsInvalid,
    #[serde(rename = "diagnostics.diagnosticReportIsUnavailable")]
    DiagnosticsDiagnosticReportIsUnavailable,
    #[serde(rename = "diagnostics.diagnosticSessionIdentifierIsInvalid")]
    DiagnosticsDiagnosticSessionIdentifierIsInvalid,
    #[serde(rename = "export.audioStreamSelectionOrProcessingSettingIsInvalid")]
    ExportAudioStreamSelectionOrProcessingSettingIsInvalid,
    #[serde(rename = "export.audioTrackIsRequired")]
    ExportAudioTrackIsRequired,
    #[serde(rename = "export.audioOutputFormatIsInvalid")]
    ExportAudioOutputFormatIsInvalid,
    #[serde(rename = "export.wavRequiresMergedAudioTracks")]
    ExportWavRequiresMergedAudioTracks,
    #[serde(rename = "export.cropSelectionIsInvalid")]
    ExportCropSelectionIsInvalid,
    #[serde(rename = "export.exportWasCancelled")]
    ExportExportWasCancelled,
    #[serde(rename = "export.fastCutCannotApplyRotationUseOptimizedRender")]
    ExportFastExportCannotApplyRotationUseOptimizedExport,
    #[serde(rename = "export.ffmpegCouldNotRenderTheSelectedSegment")]
    ExportFfmpegCouldNotRenderTheSelectedSegment,
    #[serde(rename = "export.ffmpegIsRequiredToExportVideoFiles")]
    ExportFfmpegIsRequiredToExportVideoFiles,
    #[serde(rename = "export.globalMetadataCannotBeSetWhenStrippingMetadata")]
    ExportGlobalMetadataCannotBeSetWhenStrippingMetadata,
    #[serde(rename = "export.fileOrFolderIsNoLongerAvailable")]
    ExportFileOrFolderIsNoLongerAvailable,
    #[serde(rename = "export.finalOptimizedFfmpegOptionIsMissingItsValue")]
    ExportFinalOptimizedFfmpegOptionIsMissingItsValue,
    #[serde(rename = "export.inspectTheVideoBeforeExporting")]
    ExportInspectTheVideoBeforeExporting,
    #[serde(rename = "export.optimizedArgumentsCannotOverrideInputTrimMappingFiltersOutputFormatOrOutputPaths")]
    ExportOptimizedArgumentsCannotOverrideInputTrimMappingFiltersOutputFormatOrOutputPaths,
    #[serde(rename = "export.optimizedFfmpegArgumentsContainAnUnclosedQuote")]
    ExportOptimizedFfmpegArgumentsContainAnUnclosedQuote,
    #[serde(rename = "export.outputFrameRateIsInvalid")]
    ExportOutputFrameRateIsInvalid,
    #[serde(rename = "export.outputNameIsRequired")]
    ExportOutputNameIsRequired,
    #[serde(rename = "export.outputContainerIsNotCompatibleWithSelectedStreams")]
    ExportOutputContainerIsNotCompatibleWithSelectedStreams,
    #[serde(rename = "export.outputResolutionMustBeGreaterThanZero")]
    ExportOutputResolutionMustBeGreaterThanZero,
    #[serde(rename = "export.renderedOutputIsEmpty")]
    ExportRenderedOutputIsEmpty,
    #[serde(rename = "export.renderedOutputCouldNotBeVerified")]
    ExportRenderedOutputCouldNotBeVerified,
    #[serde(rename = "export.rotationMustBe090180Or270Degrees")]
    ExportRotationMustBe090180Or270Degrees,
    #[serde(rename = "export.selectedExportRangeIsInvalid")]
    ExportSelectedExportRangeIsInvalid,
    #[serde(rename = "export.selectedOutputLocationIsNotSupported")]
    ExportSelectedOutputLocationIsNotSupported,
    #[serde(rename = "frame.capturedFrameIsNotAPngImage")]
    FrameCapturedFrameIsNotAPngImage,
    #[serde(rename = "frame.capturedFrameCouldNotBeSaved")]
    FrameCapturedFrameCouldNotBeSaved,
    #[serde(rename = "frame.capturedFrameIsTooLargeToSave")]
    FrameCapturedFrameIsTooLargeToSave,
    #[serde(rename = "frame.selectedImageLocationIsNotSupported")]
    FrameSelectedImageLocationIsNotSupported,
    #[serde(rename = "frame.suggestedFrameFilenameIsInvalid")]
    FrameSuggestedFrameFilenameIsInvalid,
    #[serde(rename = "media.audioActivity.audioActivityAnalysisContainsTooManyRanges")]
    MediaAudioActivityAudioActivityAnalysisContainsTooManyRanges,
    #[serde(rename = "media.audioActivity.audioActivityAnalysisOutputExceededItsSafetyLimit")]
    MediaAudioActivityAudioActivityAnalysisOutputExceededItsSafetyLimit,
    #[serde(rename = "media.audioActivity.audioActivityDetectionWasInterrupted")]
    MediaAudioActivityAudioActivityDetectionWasInterrupted,
    #[serde(rename = "media.audioActivity.audioActivityDetectionTookTooLong")]
    MediaAudioActivityAudioActivityDetectionTookTooLong,
    #[serde(rename = "media.audioActivity.ffmpegCouldNotAnalyzeAudioActivity")]
    MediaAudioActivityFfmpegCouldNotAnalyzeAudioActivity,
    #[serde(rename = "media.audioActivity.ffmpegIsRequiredToAnalyzeAudioActivity")]
    MediaAudioActivityFfmpegIsRequiredToAnalyzeAudioActivity,
    #[serde(rename = "media.audioActivity.inspectTheVideoBeforeDetectingAudioActivity")]
    MediaAudioActivityInspectTheVideoBeforeDetectingAudioActivity,
    #[serde(rename = "media.audio.audioPreviewsRequireInspectedSourceMedia")]
    MediaAudioAudioPreviewsRequireInspectedSourceMedia,
    #[serde(rename = "media.audio.ffmpegCouldNotPrepareAudioPreview")]
    MediaAudioFfmpegCouldNotPrepareAudioPreview,
    #[serde(rename = "media.audio.ffmpegIsRequiredToPrepareAudioPreview")]
    MediaAudioFfmpegIsRequiredToPrepareAudioPreview,
    #[serde(rename = "media.audio.preparingAudioPreviewTookTooLong")]
    MediaAudioPreparingAudioPreviewTookTooLong,
    #[serde(rename = "media.audioPreviewStreamIndexesMustBeUnique")]
    MediaAudioPreviewStreamIndexesMustBeUnique,
    #[serde(rename = "media.audio.selectedAudioStreamsCouldNotBePreparedForPreview")]
    MediaAudioSelectedAudioStreamsCouldNotBePreparedForPreview,
    #[serde(rename = "media.audioStreamMetadataIsUnavailableForWaveformGeneration")]
    MediaAudioStreamMetadataIsUnavailableForWaveformGeneration,
    #[serde(rename = "media.audio.temporaryAudioPreviewDirectoryCouldNotBeCreated")]
    MediaAudioTemporaryAudioPreviewDirectoryCouldNotBeCreated,
    #[serde(rename = "media.audio.uniqueTemporaryAudioPreviewDirectoryCouldNotBeCreated")]
    MediaAudioUniqueTemporaryAudioPreviewDirectoryCouldNotBeCreated,
    #[serde(rename = "media.inspectTheVideoBeforeDetectingAudioActivity")]
    MediaInspectTheVideoBeforeDetectingAudioActivity,
    #[serde(rename = "media.loudness.ffmpegCouldNotAnalyzeAudioLoudness")]
    MediaLoudnessFfmpegCouldNotAnalyzeAudioLoudness,
    #[serde(rename = "media.loudness.ffmpegDidNotReturnLoudnessMeasurements")]
    MediaLoudnessFfmpegDidNotReturnLoudnessMeasurements,
    #[serde(rename = "media.loudness.ffmpegIsRequiredToAnalyzeLoudness")]
    MediaLoudnessFfmpegIsRequiredToAnalyzeLoudness,
    #[serde(rename = "media.loudness.ffmpegReturnedIncompleteLoudnessMeasurements")]
    MediaLoudnessFfmpegReturnedIncompleteLoudnessMeasurements,
    #[serde(rename = "media.loudness.ffmpegReturnedInvalidLoudnessMeasurements")]
    MediaLoudnessFfmpegReturnedInvalidLoudnessMeasurements,
    #[serde(rename = "media.loudness.inspectTheVideoBeforeAnalyzingAudio")]
    MediaLoudnessInspectTheVideoBeforeAnalyzingAudio,
    #[serde(rename = "media.loudness.loudnessAnalysisWasInterrupted")]
    MediaLoudnessLoudnessAnalysisWasInterrupted,
    #[serde(rename = "media.loudness.loudnessAnalysisOutputExceededItsSafetyLimit")]
    MediaLoudnessLoudnessAnalysisOutputExceededItsSafetyLimit,
    #[serde(rename = "media.loudness.loudnessAnalysisTookTooLong")]
    MediaLoudnessLoudnessAnalysisTookTooLong,
    #[serde(rename = "media.preview.compatiblePreviewCouldNotBePreparedForThisVideo")]
    MediaPreviewCompatiblePreviewCouldNotBePreparedForThisVideo,
    #[serde(rename = "media.preview.ffmpegCouldNotPrepareACompatiblePreview")]
    MediaPreviewFfmpegCouldNotPrepareACompatiblePreview,
    #[serde(rename = "media.preview.ffmpegIsRequiredToPrepareACompatiblePreview")]
    MediaPreviewFfmpegIsRequiredToPrepareACompatiblePreview,
    #[serde(rename = "media.preview.inspectTheVideoBeforePreparingItsPreview")]
    MediaPreviewInspectTheVideoBeforePreparingItsPreview,
    #[serde(rename = "media.preview.preparingTheCompatiblePreviewTookTooLong")]
    MediaPreviewPreparingTheCompatiblePreviewTookTooLong,
    #[serde(rename = "media.preview.temporaryPreviewDirectoryCouldNotBeCreated")]
    MediaPreviewTemporaryPreviewDirectoryCouldNotBeCreated,
    #[serde(rename = "media.preview.uniqueTemporaryPreviewDirectoryCouldNotBeCreated")]
    MediaPreviewUniqueTemporaryPreviewDirectoryCouldNotBeCreated,
    #[serde(rename = "media.probe.ffprobeCouldNotInspectThisVideo")]
    MediaProbeFfprobeCouldNotInspectThisVideo,
    #[serde(rename = "media.probe.ffprobeIsRequiredToInspectVideoFiles")]
    MediaProbeFfprobeIsRequiredToInspectVideoFiles,
    #[serde(rename = "media.probe.ffprobeReturnedUnreadableMetadata")]
    MediaProbeFfprobeReturnedUnreadableMetadata,
    #[serde(rename = "media.probe.ffprobeCouldNotBeStarted")]
    MediaProbeFfprobeCouldNotBeStarted,
    #[serde(rename = "media.probe.noUsableVideoStreamWasFound")]
    MediaProbeNoUsableVideoStreamWasFound,
    #[serde(rename = "media.probe.videoContainsMoreMetadataThanTheInspectionLimitAllows")]
    MediaProbeVideoContainsMoreMetadataThanTheInspectionLimitAllows,
    #[serde(rename = "media.probe.videoDurationIsUnavailable")]
    MediaProbeVideoDurationIsUnavailable,
    #[serde(rename = "media.probe.videoHeightIsUnavailable")]
    MediaProbeVideoHeightIsUnavailable,
    #[serde(rename = "media.probe.videoInspectionExceededThe20SecondLimit")]
    MediaProbeVideoInspectionExceededThe20SecondLimit,
    #[serde(rename = "media.probe.videoWidthIsUnavailable")]
    MediaProbeVideoWidthIsUnavailable,
    #[serde(rename = "media.scene.activeSourceHasNotBeenInspected")]
    MediaSceneActiveSourceHasNotBeenInspected,
    #[serde(rename = "media.scene.ffmpegCouldNotDetectSceneChanges")]
    MediaSceneFfmpegCouldNotDetectSceneChanges,
    #[serde(rename = "media.scene.ffmpegIsRequiredToDetectSceneChanges")]
    MediaSceneFfmpegIsRequiredToDetectSceneChanges,
    #[serde(rename = "media.scene.sceneDetectionWasInterrupted")]
    MediaSceneSceneDetectionWasInterrupted,
    #[serde(rename = "media.scene.sceneDetectionOutputExceededItsSafetyLimit")]
    MediaSceneSceneDetectionOutputExceededItsSafetyLimit,
    #[serde(rename = "media.scene.sceneDetectionTookTooLong")]
    MediaSceneSceneDetectionTookTooLong,
    #[serde(rename = "media.scene.sourceContainsTooManyDetectedSceneChanges")]
    MediaSceneSourceContainsTooManyDetectedSceneChanges,
    #[serde(rename = "media.selectBetweenOneAnd32AudioStreamsForPreview")]
    MediaSelectBetweenOneAnd32AudioStreamsForPreview,
    #[serde(rename = "media.selectBetweenOneAnd32AudioStreamsForWaveformGeneration")]
    MediaSelectBetweenOneAnd32AudioStreamsForWaveformGeneration,
    #[serde(rename = "media.thumbnailCacheIsUnavailable")]
    MediaThumbnailCacheIsUnavailable,
    #[serde(rename = "media.thumbnail.sourceFileMetadataIsUnavailable")]
    MediaThumbnailSourceFileMetadataIsUnavailable,
    #[serde(rename = "media.thumbnail.sourceFileIsNoLongerAvailable")]
    MediaThumbnailSourceFileIsNoLongerAvailable,
    #[serde(rename = "media.thumbnail.temporaryThumbnailDirectoryCouldNotBeCreated")]
    MediaThumbnailTemporaryThumbnailDirectoryCouldNotBeCreated,
    #[serde(rename = "media.thumbnail.thumbnailCouldNotBeEncoded")]
    MediaThumbnailThumbnailCouldNotBeEncoded,
    #[serde(rename = "media.thumbnail.thumbnailCouldNotBePreparedForThisVideo")]
    MediaThumbnailThumbnailCouldNotBePreparedForThisVideo,
    #[serde(rename = "media.thumbnail.thumbnailCouldNotBeSavedTemporarily")]
    MediaThumbnailThumbnailCouldNotBeSavedTemporarily,
    #[serde(rename = "media.thumbnail.uniqueTemporaryThumbnailDirectoryCouldNotBeCreated")]
    MediaThumbnailUniqueTemporaryThumbnailDirectoryCouldNotBeCreated,
    #[serde(rename = "media.waveform.ffmpegCouldNotGenerateTheAudioWaveform")]
    MediaWaveformFfmpegCouldNotGenerateTheAudioWaveform,
    #[serde(rename = "media.waveform.ffmpegIsRequiredToGenerateAudioWaveforms")]
    MediaWaveformFfmpegIsRequiredToGenerateAudioWaveforms,
    #[serde(rename = "media.waveformProcessingSettingsMustMatchTheSelectedAudioStreams")]
    MediaWaveformProcessingSettingsMustMatchTheSelectedAudioStreams,
    #[serde(rename = "media.waveformStreamIndexesMustBeUnique")]
    MediaWaveformStreamIndexesMustBeUnique,
    #[serde(rename = "media.waveform.temporaryWaveformDirectoryCouldNotBeCreated")]
    MediaWaveformTemporaryWaveformDirectoryCouldNotBeCreated,
    #[serde(rename = "media.waveform.uniqueTemporaryWaveformDirectoryCouldNotBeCreated")]
    MediaWaveformUniqueTemporaryWaveformDirectoryCouldNotBeCreated,
    #[serde(rename = "media.waveform.waveformGenerationWasReplaced")]
    MediaWaveformWaveformGenerationWasReplaced,
    #[serde(rename = "media.waveform.waveformGenerationTookTooLong")]
    MediaWaveformWaveformGenerationTookTooLong,
    #[serde(rename = "queue.selectedSystemActionWasRejectedByTheSystem")]
    QueueSelectedSystemActionWasRejectedByTheSystem,
    #[serde(rename = "queue.selectedSystemActionCouldNotBeStarted")]
    QueueSelectedSystemActionCouldNotBeStarted,
    #[serde(rename = "queue.systemShutdownIsNotAvailable")]
    QueueSystemShutdownIsNotAvailable,
    #[serde(rename = "queue.systemSleepIsNotAvailable")]
    QueueSystemSleepIsNotAvailable,
    #[serde(rename = "source.fileTypeIsNotSupportedYet")]
    SourceFileTypeIsNotSupportedYet,
    #[serde(rename = "source.restoringSourceFilesFromTrashIsNotSupportedOnThisPlatform")]
    #[cfg_attr(target_os = "windows", allow(dead_code))]
    SourceRestoringSourceFilesFromTrashIsNotSupportedOnThisPlatform,
    #[serde(rename = "source.selectAVideoFileInsteadOfAFolder")]
    SourceSelectAVideoFileInsteadOfAFolder,
    #[serde(rename = "source.selectedSourceHasNoUsableFileName")]
    SourceSelectedSourceHasNoUsableFileName,
    #[serde(rename = "source.selectedSourceLocationIsNotSupported")]
    SourceSelectedSourceLocationIsNotSupported,
    #[serde(rename = "source.selectedVideoHasNoUsableFileName")]
    SourceSelectedVideoHasNoUsableFileName,
    #[serde(rename = "source.selectedVideoCouldNotBeOpened")]
    SourceSelectedVideoCouldNotBeOpened,
    #[serde(rename = "source.sourceFileCouldNotBeFoundInTrash")]
    SourceSourceFileCouldNotBeFoundInTrash,
    #[serde(rename = "source.sourcePathMustBeAbsolute")]
    SourceSourcePathMustBeAbsolute,
    #[serde(rename = "state.audioPreviewIsNotAvailable")]
    StateAudioPreviewIsNotAvailable,
    #[serde(rename = "state.operationIsNoLongerAvailable")]
    StateOperationIsNoLongerAvailable,
    #[serde(rename = "state.outputLocationIsNoLongerAvailable")]
    StateOutputLocationIsNoLongerAvailable,
    #[serde(rename = "state.waveformIsNotAvailable")]
    StateWaveformIsNotAvailable,
    #[serde(rename = "state.waveformJobIdIsInvalid")]
    StateWaveformJobIdIsInvalid,
    #[serde(rename = "source.replaced")]
    SourceReplaced,
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::{AppError, AppErrorMessageId};

    #[test]
    fn serializes_semantic_message_and_safe_arguments_without_english_message() {
        let error = AppError::invalid_request(AppErrorMessageId::MediaWaveformWidthOutOfRange)
            .with_arg("minWidth", 64_u32)
            .with_arg("maxWidth", 4096_u32);

        assert_eq!(
            serde_json::to_value(error).unwrap(),
            json!({
                "code": "invalid_request",
                "messageId": "media.waveform.widthOutOfRange",
                "messageArgs": { "minWidth": 64, "maxWidth": 4096 }
            })
        );
    }

    #[test]
    fn serializes_stream_index_as_a_number() {
        let error =
            AppError::invalid_request(AppErrorMessageId::MediaWaveformStreamDoesNotBelongToSource)
                .with_arg("streamIndex", 2_u32);

        assert_eq!(
            serde_json::to_value(error).unwrap(),
            json!({
                "code": "invalid_request",
                "messageId": "media.waveform.streamDoesNotBelongToSource",
                "messageArgs": { "streamIndex": 2 }
            })
        );
    }

    #[test]
    fn internal_failure_keeps_technical_detail_out_of_message_id() {
        let error = AppError::internal("The in-memory editing session is unavailable.");

        assert_eq!(
            serde_json::to_value(error).unwrap(),
            json!({
                "code": "internal",
                "messageId": "internal.unexpected",
                "diagnostics": "The in-memory editing session is unavailable."
            })
        );
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppError {
    pub code: &'static str,
    pub message_id: AppErrorMessageId,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message_args: Option<BTreeMap<&'static str, AppErrorMessageArg>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub diagnostics: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(untagged)]
pub enum AppErrorMessageArg {
    String(String),
    Number(u32),
}

impl From<String> for AppErrorMessageArg {
    fn from(value: String) -> Self {
        Self::String(value)
    }
}

impl From<&str> for AppErrorMessageArg {
    fn from(value: &str) -> Self {
        Self::String(value.to_owned())
    }
}

impl From<u32> for AppErrorMessageArg {
    fn from(value: u32) -> Self {
        Self::Number(value)
    }
}

impl AppError {
    fn new(code: &'static str, message_id: AppErrorMessageId, diagnostics: Option<String>) -> Self {
        Self {
            code,
            message_id,
            message_args: None,
            diagnostics,
        }
    }

    pub fn with_arg(mut self, name: &'static str, value: impl Into<AppErrorMessageArg>) -> Self {
        self.message_args
            .get_or_insert_with(BTreeMap::new)
            .insert(name, value.into());
        self
    }

    pub fn with_diagnostics(mut self, diagnostics: impl Into<String>) -> Self {
        self.diagnostics = Some(diagnostics.into());
        self
    }

    pub fn invalid_request(id: AppErrorMessageId) -> Self {
        Self::new("invalid_request", id, None)
    }
    pub fn source_replaced() -> Self {
        Self::new("source_replaced", AppErrorMessageId::SourceReplaced, None)
    }
    pub fn unsupported_media(id: AppErrorMessageId) -> Self {
        Self::new("unsupported_media", id, None)
    }
    pub fn probe_failed(id: AppErrorMessageId, diagnostics: Option<impl Into<String>>) -> Self {
        Self::new("probe_failed", id, diagnostics.map(Into::into))
    }
    pub fn preview_failed(id: AppErrorMessageId, diagnostics: Option<impl Into<String>>) -> Self {
        Self::new("preview_failed", id, diagnostics.map(Into::into))
    }
    pub fn waveform_failed(id: AppErrorMessageId, diagnostics: Option<impl Into<String>>) -> Self {
        Self::new("waveform_failed", id, diagnostics.map(Into::into))
    }
    pub fn scene_detection_failed(
        id: AppErrorMessageId,
        diagnostics: Option<impl Into<String>>,
    ) -> Self {
        Self::new("scene_detection_failed", id, diagnostics.map(Into::into))
    }
    pub fn silence_detection_failed(
        id: AppErrorMessageId,
        diagnostics: Option<impl Into<String>>,
    ) -> Self {
        Self::new("silence_detection_failed", id, diagnostics.map(Into::into))
    }
    pub fn cancelled(id: AppErrorMessageId) -> Self {
        Self::new("cancelled", id, None)
    }
    pub fn render_failed(id: AppErrorMessageId) -> Self {
        Self::new("render_failed", id, None)
    }
    pub fn render_failed_with_diagnostics(
        id: AppErrorMessageId,
        diagnostics: Option<impl Into<String>>,
    ) -> Self {
        Self::new("render_failed", id, diagnostics.map(Into::into))
    }
    pub fn io_failed(id: AppErrorMessageId) -> Self {
        Self::new("io_failed", id, None)
    }
    pub fn internal(diagnostics: impl Into<String>) -> Self {
        Self::new(
            "internal",
            AppErrorMessageId::InternalUnexpected,
            Some(diagnostics.into()),
        )
    }
}

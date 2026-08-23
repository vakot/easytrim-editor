import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useEditorViewState } from "@/app/hooks/useEditorViewState";
import { EmptyStageResizeHandle } from "./components/EmptyStageResizeHandle";
import { TimelinePane } from "./components/TimelinePane";
import { PreviewPane } from "./components/PreviewPane";

const DEFAULT_PREVIEW_SIZE = 70;
const DEFAULT_TIMELINE_SIZE = 30;

export function EditorStageEmpty() {
  const { t } = useTranslation();
  const { editorStageLayout, setEditorStageLayout, showAudioTracks } = useEditorViewState();
  const [previewSize, setPreviewSize] = useState(
    () => editorStageLayout?.["preview-panel"] ?? DEFAULT_PREVIEW_SIZE,
  );
  const [timelineSize, setTimelineSize] = useState(
    () => editorStageLayout?.["timeline-panel"] ?? DEFAULT_TIMELINE_SIZE,
  );

  const handlePreviewSizeChange = (nextPreviewSize: number) => {
    const nextTimelineSize = 100 - nextPreviewSize;
    setPreviewSize(nextPreviewSize);
    setTimelineSize(nextTimelineSize);
    setEditorStageLayout({
      "preview-panel": nextPreviewSize,
      "timeline-panel": nextTimelineSize,
    });
  };

  const handleResizeReset = () => handlePreviewSizeChange(DEFAULT_PREVIEW_SIZE);

  return (
    <div
      id="editor-stage-panels"
      role="group"
      aria-label={t("preview.panes")}
      className="flex size-full min-h-0 min-w-0 flex-col overflow-hidden bg-background"
    >
      <div
        id="preview-panel"
        className="min-h-0 min-w-0"
        style={{ flex: `${showAudioTracks ? previewSize : 100} 1 0%` }}
      >
        <PreviewPane source={null} />
      </div>

      <EmptyStageResizeHandle
        label={t("preview.resize")}
        previewSize={previewSize}
        onPreviewSizeChange={handlePreviewSizeChange}
        onDoubleClick={handleResizeReset}
      />

      <div
        id="timeline-panel"
        className="min-h-0 min-w-0 overflow-hidden"
        style={{ flex: `${showAudioTracks ? timelineSize : 0} 1 0%` }}
        aria-hidden={!showAudioTracks}
      >
        {showAudioTracks ? <TimelinePane empty audioTracks={null} /> : null}
      </div>
    </div>
  );
}

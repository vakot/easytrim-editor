import { EditorStagePanels } from "./components/EditorStagePanels";
import { TimelinePane } from "./components/TimelinePane";
import { PreviewPane } from "./components/PreviewPane";

export function EditorStageEmpty() {
  return (
    <EditorStagePanels
      sourceId={null}
      audioTrackCount={0}
      preview={<PreviewPane sourceId={null} />}
      timeline={<TimelinePane empty audioTracks={null} />}
    />
  );
}

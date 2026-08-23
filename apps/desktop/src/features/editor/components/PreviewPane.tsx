import { PreviewPaneEmpty } from "./PreviewPaneEmpty";
import { PreviewPaneContent, type PreviewPaneContentProps } from "./PreviewPaneContent";

type PreviewPaneProps = PreviewPaneContentProps | { sourceId: null };

export function PreviewPane(props: PreviewPaneProps) {
  const hasSource = props.sourceId !== null;

  return (
    <div className="grid size-full min-h-0 place-items-center overflow-auto bg-preview-surface p-4">
      {hasSource ? <PreviewPaneContent {...props} /> : <PreviewPaneEmpty />}
    </div>
  );
}

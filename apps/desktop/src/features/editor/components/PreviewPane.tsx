import { PreviewPaneEmpty } from "./PreviewPaneEmpty";
import { PreviewPaneContent, type PreviewPaneContentProps } from "./PreviewPaneContent";

interface PreviewPaneProps {
  source: PreviewPaneContentProps | null;
}

export function PreviewPane({ source }: PreviewPaneProps) {
  return (
    <div className="grid size-full min-h-0 place-items-center overflow-auto bg-preview-surface p-4">
      {source ? <PreviewPaneContent {...source} /> : <PreviewPaneEmpty />}
    </div>
  );
}

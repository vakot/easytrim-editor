import type { ReactNode } from "react";

import { PreviewPaneEmpty } from "./PreviewPaneEmpty";

interface PreviewPaneProps {
  children?: ReactNode;
  empty?: boolean;
}

export function PreviewPane({ children, empty = false }: PreviewPaneProps) {
  return (
    <div className="grid size-full min-h-0 place-items-center overflow-auto bg-preview-surface p-4">
      {empty ? <PreviewPaneEmpty /> : children}
    </div>
  );
}

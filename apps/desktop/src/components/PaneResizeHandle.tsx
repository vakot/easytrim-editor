import { Separator } from "react-resizable-panels";

interface PaneResizeHandleProps {
  id: string;
  label: string;
  orientation: "horizontal" | "vertical";
}

export function PaneResizeHandle({ id, label, orientation }: PaneResizeHandleProps) {
  return (
    <Separator
      id={id}
      aria-label={label}
      className={`pane-resize-handle pane-resize-handle-${orientation}`}
    />
  );
}

import { Panel as ResizablePanel } from "react-resizable-panels";
import type { ComponentProps } from "react";

export type PanelProps = ComponentProps<typeof ResizablePanel>;

export function Panel(props: PanelProps) {
  return <ResizablePanel {...props} />;
}

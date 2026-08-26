import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

export type PanelContentProps = ComponentProps<"div">;

export function PanelContent(props: PanelContentProps) {
  return (
    <div
      {...props}
      className={cn(
        "rounded-md border border-border h-full overflow-hidden bg-card/30",
        props.className,
      )}
    />
  );
}

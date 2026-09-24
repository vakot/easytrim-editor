import type { ReactNode } from "react";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

import {
  ApplicationCommandLabel,
  ApplicationCommandMenuItem,
} from "@/app/components/ApplicationCommandMenuItem";

interface CropViewportContextMenuProps {
  children: ReactNode;
}

function CropViewportContextMenu({ children }: CropViewportContextMenuProps) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent>
        {(
          [
            "crop-preview",
            "rotate-90-cw",
            "rotate-90-ccw",
            "rotate-180",
            "flip-horizontal",
            "flip-vertical",
            "reset-transform",
          ] as const
        ).map((commandId, index) => (
          <span key={commandId}>
            {index === 1 || index === 4 || index === 6 ? <ContextMenuSeparator /> : null}
            <ApplicationCommandMenuItem asChild commandId={commandId}>
              <ContextMenuItem>
                <ApplicationCommandLabel />
              </ContextMenuItem>
            </ApplicationCommandMenuItem>
          </span>
        ))}
      </ContextMenuContent>
    </ContextMenu>
  );
}

export { CropViewportContextMenu };

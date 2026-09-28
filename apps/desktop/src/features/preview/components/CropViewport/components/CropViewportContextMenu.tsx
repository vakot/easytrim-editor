import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

import type { ApplicationCommandId } from "@/app/commands";
import {
  ApplicationCommandLabel,
  ApplicationCommandMenuItem,
} from "@/app/components/ApplicationCommandMenuItem";

interface CropViewportContextMenuProps {
  children: ReactNode;
}

function CropViewportContextMenu({ children }: CropViewportContextMenuProps) {
  const { t } = useTranslation();

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent>
        <PreviewCommandMenuItem commandId="save-current-frame" />
        <PreviewCommandMenuItem commandId="copy-current-frame" />
        <ContextMenuSeparator />
        <PreviewCommandMenuItem commandId="crop-preview" />
        <ContextMenuSub>
          <ContextMenuSubTrigger>{t("preview.labels.transform")}</ContextMenuSubTrigger>
          <ContextMenuSubContent>
            <PreviewCommandMenuItem commandId="rotate-90-cw" keepOpen />
            <PreviewCommandMenuItem commandId="rotate-90-ccw" keepOpen />
            <PreviewCommandMenuItem commandId="rotate-180" keepOpen />
            <ContextMenuSeparator />
            <PreviewCommandMenuItem commandId="flip-horizontal" keepOpen />
            <PreviewCommandMenuItem commandId="flip-vertical" keepOpen />
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuSeparator />
        <PreviewCommandMenuItem commandId="reset-transform" />
      </ContextMenuContent>
    </ContextMenu>
  );
}

function PreviewCommandMenuItem({
  commandId,
  keepOpen = false,
}: {
  commandId: ApplicationCommandId;
  keepOpen?: boolean;
}) {
  return (
    <ApplicationCommandMenuItem asChild commandId={commandId}>
      <ContextMenuItem
        keepOpen={keepOpen}
        variant={commandId === "reset-transform" ? "destructive" : "default"}
      >
        <ApplicationCommandLabel />
      </ContextMenuItem>
    </ApplicationCommandMenuItem>
  );
}

export { CropViewportContextMenu };

import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

interface CropViewportContextMenuProps {
  children: ReactNode;
  onCrop: () => void;
  onFlipHorizontal: () => void;
  onFlipVertical: () => void;
  onReset: () => void;
  onRotateClockwise: () => void;
  onRotateCounterclockwise: () => void;
  onRotateHalfTurn: () => void;
}

export function CropViewportContextMenu({
  children,
  onCrop,
  onFlipHorizontal,
  onFlipVertical,
  onReset,
  onRotateClockwise,
  onRotateCounterclockwise,
  onRotateHalfTurn,
}: CropViewportContextMenuProps) {
  const { t } = useTranslation();

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onSelect={onCrop}>{t("preview.actions.transform.crop")}</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={onRotateClockwise}>
          {t("preview.actions.transform.rotate90Clockwise")}
        </ContextMenuItem>
        <ContextMenuItem onSelect={onRotateCounterclockwise}>
          {t("preview.actions.transform.rotate90Counterclockwise")}
        </ContextMenuItem>
        <ContextMenuItem onSelect={onRotateHalfTurn}>
          {t("preview.actions.transform.rotate180")}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={onFlipHorizontal}>
          {t("preview.actions.transform.flipHorizontal")}
        </ContextMenuItem>
        <ContextMenuItem onSelect={onFlipVertical}>
          {t("preview.actions.transform.flipVertical")}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={onReset} variant="destructive">
          {t("preview.actions.transform.reset")}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

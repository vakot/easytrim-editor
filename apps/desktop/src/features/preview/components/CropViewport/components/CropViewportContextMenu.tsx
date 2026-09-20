import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

import { useCropViewport } from "../hooks/useCropViewport";

type CropViewportState = ReturnType<typeof useCropViewport>;

interface CropViewportContextMenuProps {
  children: (viewport: CropViewportState) => ReactNode;
}

export function CropViewportContextMenu({ children }: CropViewportContextMenuProps) {
  const { t } = useTranslation();
  const viewport = useCropViewport();
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const { cropSelection, viewportFrame } = viewport;

  if (!viewport.isPreviewReady) return null;

  return (
    <AlertDialog onOpenChange={setResetDialogOpen} open={resetDialogOpen}>
      <ContextMenu>
        <ContextMenuTrigger asChild>{children(viewport)}</ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onSelect={() => cropSelection.open(viewportFrame)}>
            {t("preview.actions.transform.crop")}
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onSelect={cropSelection.rotateClockwise}>
            {t("preview.actions.transform.rotate90Clockwise")}
          </ContextMenuItem>
          <ContextMenuItem onSelect={cropSelection.rotateCounterclockwise}>
            {t("preview.actions.transform.rotate90Counterclockwise")}
          </ContextMenuItem>
          <ContextMenuItem onSelect={cropSelection.rotateHalfTurn}>
            {t("preview.actions.transform.rotate180")}
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onSelect={cropSelection.flipHorizontalAxis}>
            {t("preview.actions.transform.flipHorizontal")}
          </ContextMenuItem>
          <ContextMenuItem onSelect={cropSelection.flipVerticalAxis}>
            {t("preview.actions.transform.flipVertical")}
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onSelect={() => setResetDialogOpen(true)} variant="destructive">
            {t("preview.actions.transform.reset")}
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("preview.dialogs.reset.title")}</AlertDialogTitle>
          <AlertDialogDescription>{t("preview.dialogs.reset.description")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("common.actions.cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={cropSelection.reset} variant="destructive">
            {t("preview.actions.transform.reset")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

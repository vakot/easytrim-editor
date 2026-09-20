import { type ReactNode, useCallback, useState } from "react";
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

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  cropReset,
  flipToggled,
  rotationChanged,
  selectRotationDegrees,
} from "@/app/store/slices/crop-slice";
import { commitActiveEditingInstanceDraft } from "@/app/store/thunks/source-media-thunks";
import type { RotationDegrees } from "@/domain/rotation";

interface CropViewportContextMenuProps {
  children: ReactNode;
  onCropOpen: () => void;
  onReset: () => void;
}

function CropViewportContextMenu({ children, onCropOpen, onReset }: CropViewportContextMenuProps) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const rotationDegrees = useAppSelector(selectRotationDegrees);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);

  const rotate = useCallback(
    (delta: -90 | 90 | 180) => {
      const nextRotation = ((rotationDegrees + delta + 360) % 360) as RotationDegrees;
      dispatch(rotationChanged(nextRotation));
      dispatch(commitActiveEditingInstanceDraft());
    },
    [dispatch, rotationDegrees],
  );

  const flip = useCallback(
    (axis: "horizontal" | "vertical") => {
      dispatch(flipToggled(axis));
      dispatch(commitActiveEditingInstanceDraft());
    },
    [dispatch],
  );

  const reset = useCallback(() => {
    onReset();
    dispatch(cropReset());
    dispatch(commitActiveEditingInstanceDraft());
  }, [dispatch, onReset]);

  return (
    <AlertDialog onOpenChange={setResetDialogOpen} open={resetDialogOpen}>
      <ContextMenu>
        <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onSelect={onCropOpen}>
            {t("preview.actions.transform.crop")}
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onSelect={() => rotate(90)}>
            {t("preview.actions.transform.rotate90Clockwise")}
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => rotate(-90)}>
            {t("preview.actions.transform.rotate90Counterclockwise")}
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => rotate(180)}>
            {t("preview.actions.transform.rotate180")}
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onSelect={() => flip("horizontal")}>
            {t("preview.actions.transform.flipHorizontal")}
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => flip("vertical")}>
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
          <AlertDialogAction onClick={reset} variant="destructive">
            {t("preview.actions.transform.reset")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export { CropViewportContextMenu };

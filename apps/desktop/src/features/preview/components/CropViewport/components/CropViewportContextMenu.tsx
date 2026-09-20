import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
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
  selectFlipHorizontal,
  selectFlipVertical,
  selectRotationDegrees,
} from "@/app/store/slices/crop-slice";
import { commitActiveEditingInstanceDraft } from "@/app/store/thunks/source-media-thunks";
import type { RotationDegrees } from "@/domain/rotation";

import { useCropViewport } from "../hooks/useCropViewport";

type CropViewportState = ReturnType<typeof useCropViewport> & {
  previewTransform: string;
};

interface CropViewportContextMenuProps {
  children: (viewport: CropViewportState) => ReactNode;
}

export function CropViewportContextMenu({ children }: CropViewportContextMenuProps) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const viewport = useCropViewport();
  const flipHorizontal = useAppSelector(selectFlipHorizontal);
  const flipVertical = useAppSelector(selectFlipVertical);
  const rotationDegrees = useAppSelector(selectRotationDegrees);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const previewRotationRef = useRef<number>(rotationDegrees);
  const [previewRotationDegrees, setPreviewRotationDegrees] = useState<number>(rotationDegrees);
  const { clearDrag } = viewport.cropSelection;
  const { cropSelection, viewportFrame } = viewport;

  useEffect(() => {
    const previousRotation = normalizeRotation(previewRotationRef.current);
    if (previousRotation === rotationDegrees) return;
    const clockwiseDelta = (rotationDegrees - previousRotation + 360) % 360;
    const delta = clockwiseDelta === 270 ? -90 : clockwiseDelta;
    const nextPreviewRotation = previewRotationRef.current + delta;
    previewRotationRef.current = nextPreviewRotation;
    setPreviewRotationDegrees(nextPreviewRotation);
  }, [rotationDegrees]);

  const rotate = useCallback(
    (delta: -90 | 90 | 180) => {
      const nextRotation = ((rotationDegrees + delta + 360) % 360) as RotationDegrees;
      const nextPreviewRotation = previewRotationRef.current + delta;
      previewRotationRef.current = nextPreviewRotation;
      setPreviewRotationDegrees(nextPreviewRotation);
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
    clearDrag();
    dispatch(cropReset());
    dispatch(commitActiveEditingInstanceDraft());
  }, [clearDrag, dispatch]);

  if (!viewport.isPreviewReady) return null;

  const previewTransform = [
    viewport.sourceRenderScale < 1 ? `scale(${1 / viewport.sourceRenderScale})` : null,
    `rotate(${previewRotationDegrees}deg)`,
    flipHorizontal ? "scaleX(-1)" : null,
    flipVertical ? "scaleY(-1)" : null,
  ]
    .filter(Boolean)
    .join(" ");

  const viewportState = { ...viewport, previewTransform };

  return (
    <AlertDialog onOpenChange={setResetDialogOpen} open={resetDialogOpen}>
      <ContextMenu>
        <ContextMenuTrigger asChild>{children(viewportState)}</ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onSelect={() => cropSelection.open(viewportFrame)}>
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

function normalizeRotation(rotation: number): number {
  return ((rotation % 360) + 360) % 360;
}

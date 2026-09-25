import { RotateCcw, RotateCw, RotateCwSquare } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";

import { commandSearchTerms } from "@/app/commands/core/application-command.utils";
import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  rotationChanged,
  selectFlipHorizontal,
  selectFlipVertical,
  selectRotationDegrees,
} from "@/app/store/slices/crop-slice";
import { commitActiveEditingInstanceDraft } from "@/app/store/thunks/source-media-thunks";
import { usePreviewTransform } from "@/features/preview";

function useRotationCommands() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { isAvailable } = usePreviewTransform();
  const degrees = useAppSelector(selectRotationDegrees);
  const flipHorizontal = useAppSelector(selectFlipHorizontal);
  const flipVertical = useAppSelector(selectFlipVertical);
  const reflected = flipHorizontal !== flipVertical;
  const degreesRef = useRef(degrees);
  const reflectedRef = useRef(reflected);
  useEffect(() => {
    degreesRef.current = degrees;
    reflectedRef.current = reflected;
  }, [degrees, reflected]);
  const labels = useMemo(
    () => ({
      rotate180: t("preview.actions.transform.rotate180"),
      rotate90Clockwise: t("preview.actions.transform.rotate90Clockwise"),
      rotate90Counterclockwise: t("preview.actions.transform.rotate90Counterclockwise"),
    }),
    [t],
  );

  return (
    [
      ["rotate-90-cw", "rotate90Clockwise", 90],
      ["rotate-90-ccw", "rotate90Counterclockwise", -90],
      ["rotate-180", "rotate180", 180],
    ] as const
  ).map(([id, labelKey, delta]) => ({
    checked: degrees === (rotationDeltaForVisualDirection(delta, reflected) + 360) % 360,
    enabled: isAvailable,
    icon:
      id === "rotate-90-cw" ? (
        <RotateCw aria-hidden="true" />
      ) : id === "rotate-90-ccw" ? (
        <RotateCcw aria-hidden="true" />
      ) : (
        <RotateCwSquare aria-hidden="true" />
      ),
    run() {
      const visualDelta = reflectedRef.current && Math.abs(delta) === 90 ? -delta : delta;

      const next = ((degreesRef.current + visualDelta + 360) % 360) as 0 | 90 | 180 | 270;
      dispatch(rotationChanged(next));
      dispatch(commitActiveEditingInstanceDraft());
    },
    id,
    label: labels[labelKey],
    searchTerms: commandSearchTerms(`${labels[labelKey]}|rotate|transform`),
    variant: "default" as const,
  }));
}

function rotationDeltaForVisualDirection(delta: number, reflected: boolean): number {
  return reflected && Math.abs(delta) === 90 ? -delta : delta;
}

export { useRotationCommands };

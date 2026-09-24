import { RotateCcw, RotateCw, RotateCwSquare } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";

import { commandSearchTerms } from "@/app/commands/core/application-command.utils";
import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import { rotationChanged, selectRotationDegrees } from "@/app/store/slices/crop-slice";
import { commitActiveEditingInstanceDraft } from "@/app/store/thunks/source-media-thunks";
import { usePreviewTransform } from "@/features/preview";

function useRotationCommands() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { isAvailable } = usePreviewTransform();
  const degrees = useAppSelector(selectRotationDegrees);
  const degreesRef = useRef(degrees);
  useEffect(() => {
    degreesRef.current = degrees;
  }, [degrees]);
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
    checked: degrees === (delta + 360) % 360,
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
      const next = ((degreesRef.current + delta + 360) % 360) as 0 | 90 | 180 | 270;
      dispatch(rotationChanged(next));
      dispatch(commitActiveEditingInstanceDraft());
    },
    id,
    label: labels[labelKey],
    searchTerms: commandSearchTerms(`${labels[labelKey]}|rotate|transform`),
    variant: "default" as const,
  }));
}

export { useRotationCommands };

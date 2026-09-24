import { RotateCcw, ScissorsIcon } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";

import {
  commandSearchTerms,
  defineApplicationCommandGroup,
} from "@/app/commands/application-command.utils";
import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  flipToggled,
  rotationChanged,
  selectFlipHorizontal,
  selectFlipVertical,
  selectRotationDegrees,
} from "@/app/store/slices/crop-slice";
import { commitActiveEditingInstanceDraft } from "@/app/store/thunks/source-media-thunks";
import { usePreviewTransform } from "@/features/preview";

function usePreviewCommandGroup() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { isAvailable: isPreviewAvailable, requestCrop, requestReset } = usePreviewTransform();
  const flipHorizontal = useAppSelector(selectFlipHorizontal);
  const flipVertical = useAppSelector(selectFlipVertical);
  const rotationDegrees = useAppSelector(selectRotationDegrees);
  const rotationDegreesRef = useRef(rotationDegrees);
  useEffect(() => {
    rotationDegreesRef.current = rotationDegrees;
  }, [rotationDegrees]);
  const section = useMemo(
    () => ({ id: "preview-transform", label: t("app.labels.commandSections.previewTransform") }),
    [t],
  );

  const rotationLabels = useMemo(
    () => ({
      rotate180: t("preview.actions.transform.rotate180"),
      rotate90Clockwise: t("preview.actions.transform.rotate90Clockwise"),
      rotate90Counterclockwise: t("preview.actions.transform.rotate90Counterclockwise"),
    }),
    [t],
  );

  return useMemo(
    () =>
      defineApplicationCommandGroup("preview", [
        {
          enabled: isPreviewAvailable,
          icon: <ScissorsIcon aria-hidden="true" />,
          run: requestCrop,
          id: "crop-preview",
          label: t("preview.actions.transform.crop"),
          searchTerms: commandSearchTerms(`${t("preview.actions.transform.crop")}|crop|transform`),
          section,
          variant: "default",
        },
        ...(
          [
            ["rotate-90-cw", "rotate90Clockwise", 90],
            ["rotate-90-ccw", "rotate90Counterclockwise", -90],
            ["rotate-180", "rotate180", 180],
          ] as const
        ).map(([id, labelKey, delta]) => ({
          checked: rotationDegrees === (delta + 360) % 360,
          enabled: isPreviewAvailable,
          icon: <ScissorsIcon aria-hidden="true" />,
          run() {
            const nextRotation = ((rotationDegreesRef.current + delta + 360) % 360) as
              0 | 90 | 180 | 270;

            dispatch(rotationChanged(nextRotation));
            dispatch(commitActiveEditingInstanceDraft());
          },
          id,
          label: rotationLabels[labelKey],
          searchTerms: commandSearchTerms(`${rotationLabels[labelKey]}|rotate|transform`),
          section,
          variant: "default" as const,
        })),
        {
          checked: flipHorizontal,
          enabled: isPreviewAvailable,
          icon: <ScissorsIcon aria-hidden="true" />,
          run() {
            dispatch(flipToggled("horizontal"));
            dispatch(commitActiveEditingInstanceDraft());
          },
          id: "flip-horizontal",
          label: t("preview.actions.transform.flipHorizontal"),
          searchTerms: commandSearchTerms(
            `${t("preview.actions.transform.flipHorizontal")}|flip|transform`,
          ),
          section,
          variant: "default",
        },
        {
          checked: flipVertical,
          enabled: isPreviewAvailable,
          icon: <ScissorsIcon aria-hidden="true" />,
          run() {
            dispatch(flipToggled("vertical"));
            dispatch(commitActiveEditingInstanceDraft());
          },
          id: "flip-vertical",
          label: t("preview.actions.transform.flipVertical"),
          searchTerms: commandSearchTerms(
            `${t("preview.actions.transform.flipVertical")}|flip|transform`,
          ),
          section,
          variant: "default",
        },
        {
          enabled: isPreviewAvailable,
          icon: <RotateCcw aria-hidden="true" />,
          run: requestReset,
          id: "reset-transform",
          label: t("preview.actions.transform.reset"),
          searchTerms: commandSearchTerms(
            `${t("preview.actions.transform.reset")}|reset|transform`,
          ),
          section,
          variant: "destructive",
        },
      ]),
    [
      dispatch,
      flipHorizontal,
      flipVertical,
      isPreviewAvailable,
      requestCrop,
      requestReset,
      rotationDegrees,
      rotationLabels,
      section,
      t,
    ],
  );
}

export { usePreviewCommandGroup };

import { FlipHorizontal2, FlipVertical2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { commandSearchTerms } from "@/app/commands/core/application-command.utils";
import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  flipToggled,
  selectFlipHorizontal,
  selectFlipVertical,
} from "@/app/store/slices/crop-slice";
import { commitActiveEditingInstanceDraft } from "@/app/store/thunks/source-media-thunks";
import { usePreviewTransform } from "@/features/preview";

function useFlipCommands() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { isAvailable } = usePreviewTransform();
  const horizontal = useAppSelector(selectFlipHorizontal);
  const vertical = useAppSelector(selectFlipVertical);
  const labels = {
    horizontal: t("preview.actions.transform.flipHorizontal"),
    vertical: t("preview.actions.transform.flipVertical"),
  };

  return (
    [
      { axis: "horizontal", checked: horizontal, id: "flip-horizontal" as const },
      { axis: "vertical", checked: vertical, id: "flip-vertical" as const },
    ] as const
  ).map(({ axis, checked, id }) => ({
    checked,
    enabled: isAvailable,
    icon:
      axis === "horizontal" ? (
        <FlipHorizontal2 aria-hidden="true" />
      ) : (
        <FlipVertical2 aria-hidden="true" />
      ),
    run() {
      dispatch(flipToggled(axis));
      dispatch(commitActiveEditingInstanceDraft());
    },
    id,
    label: labels[axis],
    searchTerms: commandSearchTerms(`${labels[axis]}|flip|transform`),
    variant: "default" as const,
  }));
}

export { useFlipCommands };

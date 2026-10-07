import { FlipHorizontal2, FlipVertical2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { commandSearchTerms } from "@/app/commands/core/application-command.utils";
import { useAppDispatch } from "@/app/store/redux-hooks";
import { flipToggled } from "@/app/store/slices/crop-slice";
import { commitActiveEditingInstanceDraft } from "@/app/store/thunks/source-media-thunks";
import { usePreviewTransform } from "@/features/preview";

function useFlipCommands() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { isAvailable } = usePreviewTransform();
  const labels = {
    horizontal: t("preview.transform.flipHorizontal"),
    vertical: t("preview.transform.flipVertical"),
  };

  return (
    [
      { axis: "horizontal", id: "flip-horizontal" as const },
      { axis: "vertical", id: "flip-vertical" as const },
    ] as const
  ).map(({ axis, id }) => ({
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

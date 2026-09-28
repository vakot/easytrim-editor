import { RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { ApplicationCommandDefinition } from "@/app/commands/core/application-command.types";
import { commandSearchTerms } from "@/app/commands/core/application-command.utils";
import {
  DEFAULT_UI_SCALE_PERCENT,
  MAX_UI_SCALE_PERCENT,
  MIN_UI_SCALE_PERCENT,
} from "@/app/preferences";
import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  selectUiScalePercent,
  uiScaleDecreased,
  uiScaleIncreased,
  uiScalingReset,
} from "@/app/store/slices/preferences-slice";

function useUiScalingCommands() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const uiScalePercent = useAppSelector(selectUiScalePercent);
  const zoomInLabel = t("app.actions.zoomIn");
  const zoomOutLabel = t("app.actions.zoomOut");
  const resetLabel = t("app.actions.resetToDefault");

  return [
    {
      enabled: uiScalePercent < MAX_UI_SCALE_PERCENT,
      hint: "+25%",
      icon: <ZoomIn aria-hidden="true" />,
      surfaces: ["menu", "palette"] as const,
      run() {
        dispatch(uiScaleIncreased());
      },
      id: "ui-scale-zoom-in" as const,
      label: zoomInLabel,
      searchTerms: commandSearchTerms(`${zoomInLabel}|zoom in|ui scaling|view`),
      variant: "default" as const,
      keepOpen: true,
    },
    {
      enabled: uiScalePercent > MIN_UI_SCALE_PERCENT,
      hint: "-25%",
      icon: <ZoomOut aria-hidden="true" />,
      surfaces: ["menu", "palette"] as const,
      run() {
        dispatch(uiScaleDecreased());
      },
      id: "ui-scale-zoom-out" as const,
      label: zoomOutLabel,
      searchTerms: commandSearchTerms(`${zoomOutLabel}|zoom out|ui scaling|view`),
      variant: "default" as const,
      keepOpen: true,
    },
    {
      enabled: uiScalePercent !== DEFAULT_UI_SCALE_PERCENT,
      icon: <RotateCcw aria-hidden="true" />,
      surfaces: ["menu"] as const,
      run() {
        dispatch(uiScalingReset());
      },
      id: "ui-scale-reset" as const,
      label: resetLabel,
      searchTerms: commandSearchTerms(`${resetLabel}|ui scaling|zoom|view`),
      variant: "default" as const,
    },
  ] as const satisfies readonly ApplicationCommandDefinition[];
}

export { useUiScalingCommands };

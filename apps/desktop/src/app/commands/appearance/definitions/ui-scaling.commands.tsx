import { RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { ApplicationCommandDefinition } from "@/app/commands/core/application-command.types";
import { commandSearchTerms } from "@/app/commands/core/application-command.utils";
import { useUiScaleFeedback } from "@/app/contexts/ui-scale-feedback-context";
import {
  DEFAULT_UI_SCALE_PERCENT,
  MAX_UI_SCALE_PERCENT,
  MIN_UI_SCALE_PERCENT,
  UI_SCALE_STEP_PERCENT,
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
  const { showScale } = useUiScaleFeedback();
  const uiScalePercent = useAppSelector(selectUiScalePercent);
  const zoomInLabel = t("layout.zoomIn");
  const zoomOutLabel = t("layout.zoomOut");
  const resetLabel = t("layout.zoomReset");

  return [
    {
      enabled: uiScalePercent < MAX_UI_SCALE_PERCENT,
      icon: <ZoomIn aria-hidden="true" />,
      shortcut: { code: "Equal", key: "=", modifier: "control" },
      run({ surface }) {
        dispatch(uiScaleIncreased());
        if (surface === "hotkey") {
          showScale(Math.min(MAX_UI_SCALE_PERCENT, uiScalePercent + UI_SCALE_STEP_PERCENT));
        }
      },
      id: "ui-scale-zoom-in" as const,
      label: zoomInLabel,
      searchTerms: commandSearchTerms(`${zoomInLabel}|zoom in|ui scaling|view`),
      variant: "default" as const,
      keepOpen: true,
    },
    {
      enabled: uiScalePercent > MIN_UI_SCALE_PERCENT,
      icon: <ZoomOut aria-hidden="true" />,
      shortcut: { code: "Minus", key: "-", modifier: "control" },
      run({ surface }) {
        dispatch(uiScaleDecreased());
        if (surface === "hotkey") {
          showScale(Math.max(MIN_UI_SCALE_PERCENT, uiScalePercent - UI_SCALE_STEP_PERCENT));
        }
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
      shortcut: { code: "Digit0", key: "0", modifier: "control" },
      run({ surface }) {
        dispatch(uiScalingReset());
        if (surface === "hotkey") showScale(DEFAULT_UI_SCALE_PERCENT);
      },
      id: "ui-scale-reset" as const,
      label: resetLabel,
      searchTerms: commandSearchTerms(`${resetLabel}|ui scaling|zoom|view`),
      variant: "default" as const,
      keepOpen: true,
    },
  ] as const satisfies readonly ApplicationCommandDefinition[];
}

export { useUiScalingCommands };

import { Clapperboard, Eye } from "lucide-react";
import { useTranslation } from "react-i18next";

import { commandSearchTerms } from "@/app/commands/core/application-command.utils";
import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  sceneMarkersToggled,
  selectSceneDetectionStatus,
  selectSceneMarkersVisible,
} from "@/app/store/slices/scene-detection-slice";
import { selectSourceReady } from "@/app/store/slices/source-slice";
import { detectActiveSourceScenes } from "@/app/store/thunks/scene-detection-thunks";

function useSceneCommands() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const sourceReady = useAppSelector(selectSourceReady);
  const { status } = useAppSelector(selectSceneDetectionStatus);
  const markersVisible = useAppSelector(selectSceneMarkersVisible);
  const findLabel = t("timeline.sceneMarkers.actions.findSceneChanges");
  const showLabel = t("timeline.sceneMarkers.actions.enableSceneMarkers");
  const hideLabel = t("timeline.sceneMarkers.actions.disableSceneMarkers");

  return [
    {
      enabled: sourceReady && (status === "idle" || status === "failed"),
      icon: <Clapperboard aria-hidden="true" />,
      id: "detect-scenes" as const,
      label: findLabel,
      async run() {
        await dispatch(detectActiveSourceScenes());
      },
      searchTerms: commandSearchTerms(`${findLabel}|scene|detect`),
      surfaces: ["button", "palette"] as const,
      variant: "default" as const,
    },
    {
      checked: markersVisible,
      enabled: status === "ready",
      icon: <Eye aria-hidden="true" />,
      id: "show-scene-markers" as const,
      label: markersVisible ? hideLabel : showLabel,
      run() {
        dispatch(sceneMarkersToggled());
      },
      searchTerms: commandSearchTerms(`${showLabel}|${hideLabel}|scene|markers|show`),
      surfaces: ["button", "palette"] as const,
      variant: "default" as const,
    },
  ] as const;
}

export { useSceneCommands };

import { ChevronsLeft, ChevronsRight, Clapperboard, Eye } from "lucide-react";
import { useTranslation } from "react-i18next";

import { commandSearchTerms } from "@/app/commands/core/application-command.utils";
import { usePlayback } from "@/app/hooks/usePlayback";
import { useTimeline } from "@/app/hooks/useTimeline";
import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import { selectActiveSceneBoundariesMicros } from "@/app/store/slices/editing-instances-slice";
import {
  sceneMarkersToggled,
  selectSceneMarkersEnabled,
} from "@/app/store/slices/editor-tools-slice";
import { selectSourceReady } from "@/app/store/slices/source-slice";
import {
  findNextSceneBoundary,
  findPreviousSceneBoundary,
  useSceneDetection,
} from "@/features/timeline";

function useSceneCommands() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const timeline = useTimeline();
  const playback = usePlayback();
  const sceneMarkersEnabled = useAppSelector(selectSceneMarkersEnabled);
  const sceneBoundariesMicros = useAppSelector(selectActiveSceneBoundariesMicros);
  const sourceReady = useAppSelector(selectSourceReady);
  const sceneDetection = useSceneDetection(sourceReady);
  const firstSceneStartMicros = timeline.trim?.startMicros ?? 0;

  const previousSceneMicros = findPreviousSceneBoundary(
    sceneBoundariesMicros,
    timeline.playheadMicros,
    firstSceneStartMicros,
  );

  const nextSceneMicros = findNextSceneBoundary(sceneBoundariesMicros, timeline.playheadMicros);
  const showSceneMarkers = t("timeline.actions.enableSceneMarkers");
  const detectScenes = t("timeline.actions.detectScenes");
  const previousScene = t("preview.actions.previousScene");
  const nextScene = t("preview.actions.nextScene");

  function moveToScene(sceneMicros: number) {
    playback.pause();
    timeline.onScrubStart();
    timeline.onSeek(sceneMicros);
    timeline.onScrubEnd();
  }

  return [
    {
      enabled:
        sceneDetection.canDetect && !sceneDetection.hasDetected && !sceneDetection.isDetecting,
      icon: <Clapperboard aria-hidden="true" />,
      id: "detect-scenes" as const,
      label: detectScenes,
      run: sceneDetection.detect,
      searchTerms: commandSearchTerms(`${detectScenes}|scene detection|analyze scenes`),
      surfaces: ["button", "palette"] as const,
      variant: "default" as const,
    },
    {
      enabled: sceneMarkersEnabled && playback.canInteract && previousSceneMicros !== undefined,
      icon: <ChevronsLeft aria-hidden="true" />,
      id: "previous-scene" as const,
      label: previousScene,
      run() {
        if (previousSceneMicros !== undefined) moveToScene(previousSceneMicros);
      },
      searchTerms: commandSearchTerms(`${previousScene}|scene|previous`),
      surfaces: ["button", "palette"] as const,
      variant: "default" as const,
    },
    {
      enabled: sceneMarkersEnabled && playback.canInteract && nextSceneMicros !== undefined,
      icon: <ChevronsRight aria-hidden="true" />,
      id: "next-scene" as const,
      label: nextScene,
      run() {
        if (nextSceneMicros !== undefined) moveToScene(nextSceneMicros);
      },
      searchTerms: commandSearchTerms(`${nextScene}|scene|next`),
      surfaces: ["button", "palette"] as const,
      variant: "default" as const,
    },
    {
      checked: sceneMarkersEnabled,
      enabled: sceneDetection.hasDetected,
      icon: <Eye aria-hidden="true" />,
      id: "show-scene-markers" as const,
      label: showSceneMarkers,
      run() {
        dispatch(sceneMarkersToggled());
      },
      searchTerms: commandSearchTerms(`${showSceneMarkers}|scene|markers|show`),
      surfaces: ["button", "palette"] as const,
      variant: "default" as const,
    },
  ] as const;
}

export { useSceneCommands };

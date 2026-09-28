import { ChevronsLeft, ChevronsRight, Clapperboard, Eye } from "lucide-react";
import { useRef } from "react";
import { useTranslation } from "react-i18next";

import { commandSearchTerms } from "@/app/commands/core/application-command.utils";
import { usePlayback } from "@/app/hooks/usePlayback";
import { useTimeline } from "@/app/hooks/useTimeline";
import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import { selectActiveSceneBoundariesMicros } from "@/app/store/slices/editing-instances-slice";
import { sceneMarkersToggled, selectSceneMarkersEnabled } from "@/app/store/slices/editor-tools-slice";
import { selectSourceReady } from "@/app/store/slices/source-slice";
import { findNextSceneBoundary, findPreviousSceneBoundary, useSceneDetection } from "@/features/timeline";

const SCENE_NAVIGATION_REPEAT_WINDOW_MS = 125;

function useSceneCommands() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const timeline = useTimeline();
  const playback = usePlayback();
  const sceneMarkersEnabled = useAppSelector(selectSceneMarkersEnabled);
  const sceneBoundariesMicros = useAppSelector(selectActiveSceneBoundariesMicros);
  const sourceReady = useAppSelector(selectSourceReady);
  const sceneDetection = useSceneDetection(sourceReady);
  const previousSceneNavigationRef = useRef<{
    invokedAt: number;
    playbackWasActive: boolean;
    targetMicros: number;
  } | null>(null);

  const previousSceneMicros = findPreviousSceneBoundary(
    sceneBoundariesMicros,
    timeline.playheadMicros,
  );

  const nextSceneMicros = findNextSceneBoundary(sceneBoundariesMicros, timeline.playheadMicros);
  const showSceneMarkers = t("timeline.actions.enableSceneMarkers");
  const detectScenes = t("timeline.actions.detectScenes");
  const previousScene = t("preview.actions.previousScene");
  const nextScene = t("preview.actions.nextScene");

  function moveToScene(sceneMicros: number) {
    timeline.onScrubStart();
    timeline.onSeek(sceneMicros);
    timeline.onScrubEnd();
  }

  function moveToPreviousScene() {
    const now = performance.now();
    const previousNavigation = previousSceneNavigationRef.current;
    const isRepeatWhilePlaying =
      previousNavigation !== null &&
      previousNavigation.playbackWasActive &&
      now - previousNavigation.invokedAt <= SCENE_NAVIGATION_REPEAT_WINDOW_MS;

    const targetMicros = isRepeatWhilePlaying
      ? findPreviousSceneBoundary(sceneBoundariesMicros, previousNavigation.targetMicros)
      : previousSceneMicros;

    if (targetMicros === undefined) {
      previousSceneNavigationRef.current = null;
      return;
    }

    previousSceneNavigationRef.current =
      playback.isPlaying || isRepeatWhilePlaying
        ? { invokedAt: now, playbackWasActive: true, targetMicros }
        : null;
    moveToScene(targetMicros);
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
        moveToPreviousScene();
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
        previousSceneNavigationRef.current = null;
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

import { AudioLines, ChevronsLeft, ChevronsRight, Clapperboard, Eye } from "lucide-react";
import { useTranslation } from "react-i18next";

import { commandSearchTerms } from "@/app/commands/core/application-command.utils";
import { usePlayback } from "@/app/hooks/usePlayback";
import { useTimeline } from "@/app/hooks/useTimeline";
import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import { selectActiveSceneBoundariesMicros } from "@/app/store/slices/editing-instances-slice";
import {
  sceneMarkersToggled,
  selectSceneMarkersEnabled,
  selectSilenceMarkersEnabled,
  silenceMarkersToggled,
} from "@/app/store/slices/editor-tools-slice";
import { selectSourceReady } from "@/app/store/slices/source-slice";
import {
  findNextSceneBoundary,
  findNextSilence,
  findPreviousSceneBoundary,
  findPreviousSilence,
  useSceneDetection,
  useSilenceDetection,
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
  const silenceDetection = useSilenceDetection(sourceReady);
  const firstSceneStartMicros = timeline.trim?.startMicros ?? 0;
  const silenceMarkersEnabled = useAppSelector(selectSilenceMarkersEnabled);

  const previousSceneMicros = findPreviousSceneBoundary(
    sceneBoundariesMicros,
    timeline.playheadMicros,
    firstSceneStartMicros,
  );

  const nextSceneMicros = findNextSceneBoundary(sceneBoundariesMicros, timeline.playheadMicros);
  const previousSilenceMicros = findPreviousSilence(
    silenceDetection.ranges,
    timeline.playheadMicros,
  );

  const nextSilenceMicros = findNextSilence(silenceDetection.ranges, timeline.playheadMicros);
  const showSceneMarkers = t("timeline.actions.enableSceneMarkers");
  const detectScenes = t("timeline.actions.detectScenes");
  const previousScene = t("preview.actions.previousScene");
  const nextScene = t("preview.actions.nextScene");
  const detectSilenceLabel = t("timeline.actions.detectSilence");
  const showSilenceMarkers = silenceMarkersEnabled
    ? t("timeline.actions.disableSilenceMarkers")
    : t("timeline.actions.enableSilenceMarkers");

  function moveToSilence(timeMicros: number) {
    playback.pause();
    timeline.onScrubStart();
    timeline.onSeek(timeMicros);
    timeline.onScrubEnd();
  }

  function moveToScene(sceneMicros: number) {
    playback.pause();
    timeline.onScrubStart();
    timeline.onSeek(sceneMicros);
    timeline.onScrubEnd();
  }

  return [
    {
      enabled:
        silenceDetection.canDetect &&
        !silenceDetection.hasDetected &&
        !silenceDetection.isDetecting,
      icon: <AudioLines aria-hidden="true" />,
      id: "detect-silence" as const,
      label: detectSilenceLabel,
      run: silenceDetection.detect,
      searchTerms: commandSearchTerms(`${detectSilenceLabel}|silence detection|find silence`),
      surfaces: ["button", "palette"] as const,
      variant: "default" as const,
    },
    {
      enabled: silenceMarkersEnabled && playback.canInteract && previousSilenceMicros !== undefined,
      icon: <ChevronsLeft aria-hidden="true" />,
      id: "previous-silence" as const,
      label: t("preview.actions.previousSilence"),
      run() {
        if (previousSilenceMicros !== undefined) moveToSilence(previousSilenceMicros);
      },
      searchTerms: commandSearchTerms(`${t("preview.actions.previousSilence")}|silence|previous`),
      surfaces: ["button", "palette"] as const,
      variant: "default" as const,
    },
    {
      enabled: silenceMarkersEnabled && playback.canInteract && nextSilenceMicros !== undefined,
      icon: <ChevronsRight aria-hidden="true" />,
      id: "next-silence" as const,
      label: t("preview.actions.nextSilence"),
      run() {
        if (nextSilenceMicros !== undefined) moveToSilence(nextSilenceMicros);
      },
      searchTerms: commandSearchTerms(`${t("preview.actions.nextSilence")}|silence|next`),
      surfaces: ["button", "palette"] as const,
      variant: "default" as const,
    },
    {
      checked: silenceMarkersEnabled,
      enabled: silenceDetection.hasDetected,
      icon: <Eye aria-hidden="true" />,
      id: "show-silence-markers" as const,
      label: showSilenceMarkers,
      run() {
        dispatch(silenceMarkersToggled());
      },
      searchTerms: commandSearchTerms(`${showSilenceMarkers}|silence|markers|show`),
      surfaces: ["button", "palette"] as const,
      variant: "default" as const,
    },
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

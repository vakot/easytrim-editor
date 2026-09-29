import { AudioLines, ChevronsLeft, ChevronsRight, Clapperboard, Eye } from "lucide-react";
import { useTranslation } from "react-i18next";

import { commandSearchTerms } from "@/app/commands/core/application-command.utils";
import { usePlayback } from "@/app/hooks/usePlayback";
import { useTimeline } from "@/app/hooks/useTimeline";
import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import { selectActiveSceneBoundariesMicros } from "@/app/store/slices/editing-instances-slice";
import {
  audioActivityMarkersToggled,
  sceneMarkersToggled,
  selectAudioActivityMarkersEnabled,
  selectSceneMarkersEnabled,
} from "@/app/store/slices/editor-tools-slice";
import { selectSourceReady } from "@/app/store/slices/source-slice";
import {
  findNextMarker,
  findPreviousMarker,
  useAudioActivityDetection,
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
  const audioActivityDetection = useAudioActivityDetection(sourceReady);
  const audioActivityMarkersEnabled = useAppSelector(selectAudioActivityMarkersEnabled);
  const visibleSceneBoundaries = sceneMarkersEnabled ? sceneBoundariesMicros : [];
  const visibleAudioActivityRanges = audioActivityMarkersEnabled
    ? audioActivityDetection.ranges
    : [];

  const visibleMarkersMicros = [
    ...visibleSceneBoundaries,
    ...visibleAudioActivityRanges.map(({ startMicros }) => startMicros),
  ];

  const previousMarkerMicros = findPreviousMarker(visibleMarkersMicros, timeline.playheadMicros);
  const nextMarkerMicros = findNextMarker(visibleMarkersMicros, timeline.playheadMicros);

  function moveToMarker(timeMicros: number) {
    playback.pause();
    timeline.onScrubStart();
    timeline.onSeek(timeMicros);
    timeline.onScrubEnd();
  }

  const sceneCommands = [
    {
      enabled:
        sceneDetection.canDetect && !sceneDetection.hasDetected && !sceneDetection.isDetecting,
      icon: <Clapperboard aria-hidden="true" />,
      id: "detect-scenes" as const,
      label: t("timeline.actions.detectScenes"),
      run: sceneDetection.detect,
      searchTerms: commandSearchTerms(
        `${t("timeline.actions.detectScenes")}|scene detection|analyze scenes`,
      ),
      surfaces: ["button", "palette"] as const,
      variant: "default" as const,
    },
    {
      checked: sceneMarkersEnabled,
      enabled: sceneDetection.hasDetected,
      icon: <Eye aria-hidden="true" />,
      id: "show-scene-markers" as const,
      label: sceneMarkersEnabled
        ? t("timeline.actions.disableSceneMarkers")
        : t("timeline.actions.enableSceneMarkers"),
      run() {
        dispatch(sceneMarkersToggled());
      },
      searchTerms: commandSearchTerms(
        `${t("timeline.actions.enableSceneMarkers")}|${t("timeline.actions.disableSceneMarkers")}|scene|markers|show`,
      ),
      surfaces: ["button", "palette"] as const,
      variant: "default" as const,
    },
  ] as const;

  const audioActivityCommands = [
    {
      enabled:
        audioActivityDetection.canDetect &&
        !audioActivityDetection.hasDetected &&
        !audioActivityDetection.isDetecting,
      icon: <AudioLines aria-hidden="true" />,
      id: "detect-audio-activity" as const,
      label: t("timeline.actions.detectAudioActivity"),
      run: audioActivityDetection.detect,
      searchTerms: commandSearchTerms(
        `${t("timeline.actions.detectAudioActivity")}|audio activity detection|find audio`,
      ),
      surfaces: ["button", "palette"] as const,
      variant: "default" as const,
    },
    {
      checked: audioActivityMarkersEnabled,
      enabled: audioActivityDetection.hasDetected,
      icon: <Eye aria-hidden="true" />,
      id: "show-audio-activity-markers" as const,
      label: audioActivityMarkersEnabled
        ? t("timeline.actions.disableAudioActivityMarkers")
        : t("timeline.actions.enableAudioActivityMarkers"),
      run() {
        dispatch(audioActivityMarkersToggled());
      },
      searchTerms: commandSearchTerms(
        `${t("timeline.actions.enableAudioActivityMarkers")}|audio activity|markers|show`,
      ),
      surfaces: ["button", "palette"] as const,
      variant: "default" as const,
    },
  ] as const;

  const markerCommands = [
    {
      enabled: playback.canInteract && previousMarkerMicros !== undefined,
      icon: <ChevronsLeft aria-hidden="true" />,
      id: "previous-marker" as const,
      label: t("preview.actions.previousMarker"),
      run() {
        if (previousMarkerMicros !== undefined) moveToMarker(previousMarkerMicros);
      },
      searchTerms: commandSearchTerms(`${t("preview.actions.previousMarker")}|previous|marker`),
      surfaces: ["button", "palette"] as const,
      variant: "default" as const,
    },
    {
      enabled: playback.canInteract && nextMarkerMicros !== undefined,
      icon: <ChevronsRight aria-hidden="true" />,
      id: "next-marker" as const,
      label: t("preview.actions.nextMarker"),
      run() {
        if (nextMarkerMicros !== undefined) moveToMarker(nextMarkerMicros);
      },
      searchTerms: commandSearchTerms(`${t("preview.actions.nextMarker")}|next|marker`),
      surfaces: ["button", "palette"] as const,
      variant: "default" as const,
    },
  ] as const;

  return { audioActivityCommands, markerCommands, sceneCommands } as const;
}

export { useSceneCommands };

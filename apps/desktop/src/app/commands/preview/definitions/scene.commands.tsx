import { ChevronsLeft, ChevronsRight, Clapperboard, Eye } from "lucide-react";
import { useTranslation } from "react-i18next";

import { commandSearchTerms } from "@/app/commands/core/application-command.utils";
import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import { selectAudioTracks } from "@/app/store/slices/audio-slice";
import { selectActiveSceneBoundariesMicros } from "@/app/store/slices/editing-instances-slice";
import {
  sceneMarkersToggled,
  selectSceneMarkersEnabled,
} from "@/app/store/slices/editor-tools-slice";
import { selectSourceReady } from "@/app/store/slices/source-slice";
import { audioTrackColor } from "@/features/audio";
import {
  createTimelineMarkers,
  findNextMarker,
  findPreviousMarker,
  timelineMarkerTimes,
  useSceneDetection,
  useTimeline,
  useTimelineReadiness,
  useTimelineTransport,
} from "@/features/timeline";

function useSceneCommands() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const timeline = useTimeline();
  const readiness = useTimelineReadiness();
  const playback = useTimelineTransport();
  const sceneMarkersEnabled = useAppSelector(selectSceneMarkersEnabled);
  const sceneBoundariesMicros = useAppSelector(selectActiveSceneBoundariesMicros);
  const sourceReady = useAppSelector(selectSourceReady);
  const sceneDetection = useSceneDetection(sourceReady);
  const audioTracks = useAppSelector(selectAudioTracks);
  const visibleSceneBoundaries = sceneMarkersEnabled ? sceneBoundariesMicros : [];
  const markers = createTimelineMarkers(visibleSceneBoundaries, audioTracks, audioTrackColor);

  const visibleMarkersMicros = timelineMarkerTimes(markers);

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
      label: t("timeline.sceneMarkers.actions.detectScenes"),
      run: sceneDetection.detect,
      searchTerms: commandSearchTerms(
        `${t("timeline.sceneMarkers.actions.detectScenes")}|scene detection|analyze scenes`,
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
        ? t("timeline.sceneMarkers.actions.disableSceneMarkers")
        : t("timeline.sceneMarkers.actions.enableSceneMarkers"),
      run() {
        dispatch(sceneMarkersToggled());
      },
      searchTerms: commandSearchTerms(
        `${t("timeline.sceneMarkers.actions.enableSceneMarkers")}|${t("timeline.sceneMarkers.actions.disableSceneMarkers")}|scene|markers|show`,
      ),
      surfaces: ["button", "palette"] as const,
      variant: "default" as const,
    },
  ] as const;

  const markerCommands = [
    {
      enabled: readiness.canInteract && previousMarkerMicros !== undefined,
      icon: <ChevronsLeft aria-hidden="true" />,
      id: "previous-marker" as const,
      label: t("preview.markers.previousMarker"),
      run() {
        if (previousMarkerMicros !== undefined) moveToMarker(previousMarkerMicros);
      },
      searchTerms: commandSearchTerms(`${t("preview.markers.previousMarker")}|previous|marker`),
      surfaces: ["button", "palette"] as const,
      variant: "default" as const,
    },
    {
      enabled: readiness.canInteract && nextMarkerMicros !== undefined,
      icon: <ChevronsRight aria-hidden="true" />,
      id: "next-marker" as const,
      label: t("preview.markers.nextMarker"),
      run() {
        if (nextMarkerMicros !== undefined) moveToMarker(nextMarkerMicros);
      },
      searchTerms: commandSearchTerms(`${t("preview.markers.nextMarker")}|next|marker`),
      surfaces: ["button", "palette"] as const,
      variant: "default" as const,
    },
  ] as const;

  return { markerCommands, sceneCommands } as const;
}

export { useSceneCommands };

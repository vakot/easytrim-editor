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
  findNextSegment,
  findPreviousSegment,
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
  const silenceMarkersEnabled = useAppSelector(selectSilenceMarkersEnabled);
  const visibleSceneBoundaries = sceneMarkersEnabled ? sceneBoundariesMicros : [];
  const visibleSilenceRanges = silenceMarkersEnabled ? silenceDetection.ranges : [];
  const firstSceneStartMicros =
    sceneMarkersEnabled && sceneDetection.hasDetected
      ? (timeline.trim?.startMicros ?? 0)
      : undefined;

  const previousSegmentMicros = findPreviousSegment(
    visibleSceneBoundaries,
    visibleSilenceRanges,
    timeline.playheadMicros,
    firstSceneStartMicros,
  );

  const nextSegmentMicros = findNextSegment(
    visibleSceneBoundaries,
    visibleSilenceRanges,
    timeline.playheadMicros,
  );

  function moveToSegment(timeMicros: number) {
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

  const silenceCommands = [
    {
      enabled:
        silenceDetection.canDetect &&
        !silenceDetection.hasDetected &&
        !silenceDetection.isDetecting,
      icon: <AudioLines aria-hidden="true" />,
      id: "detect-silence" as const,
      label: t("timeline.actions.detectSilence"),
      run: silenceDetection.detect,
      searchTerms: commandSearchTerms(
        `${t("timeline.actions.detectSilence")}|silence detection|find silence`,
      ),
      surfaces: ["button", "palette"] as const,
      variant: "default" as const,
    },
    {
      checked: silenceMarkersEnabled,
      enabled: silenceDetection.hasDetected,
      icon: <Eye aria-hidden="true" />,
      id: "show-silence-markers" as const,
      label: silenceMarkersEnabled
        ? t("timeline.actions.disableSilenceMarkers")
        : t("timeline.actions.enableSilenceMarkers"),
      run() {
        dispatch(silenceMarkersToggled());
      },
      searchTerms: commandSearchTerms(
        `${t("timeline.actions.enableSilenceMarkers")}|silence|markers|show`,
      ),
      surfaces: ["button", "palette"] as const,
      variant: "default" as const,
    },
  ] as const;

  const segmentCommands = [
    {
      enabled: playback.canInteract && previousSegmentMicros !== undefined,
      icon: <ChevronsLeft aria-hidden="true" />,
      id: "previous-segment" as const,
      label: t("preview.actions.previousSegment"),
      run() {
        if (previousSegmentMicros !== undefined) moveToSegment(previousSegmentMicros);
      },
      searchTerms: commandSearchTerms(`${t("preview.actions.previousSegment")}|previous|segment`),
      surfaces: ["button", "palette"] as const,
      variant: "default" as const,
    },
    {
      enabled: playback.canInteract && nextSegmentMicros !== undefined,
      icon: <ChevronsRight aria-hidden="true" />,
      id: "next-segment" as const,
      label: t("preview.actions.nextSegment"),
      run() {
        if (nextSegmentMicros !== undefined) moveToSegment(nextSegmentMicros);
      },
      searchTerms: commandSearchTerms(`${t("preview.actions.nextSegment")}|next|segment`),
      surfaces: ["button", "palette"] as const,
      variant: "default" as const,
    },
  ] as const;

  return { sceneCommands, segmentCommands, silenceCommands } as const;
}

export { useSceneCommands };

import { useTranslation } from "react-i18next";

import { defineApplicationCommandGroup } from "@/app/commands/core/application-command.utils";

import { useCopyFrameCommand } from "./definitions/copy-frame.command";
import { useCropPreviewCommand } from "./definitions/crop.command";
import { useFlipCommands } from "./definitions/flip.commands";
import { useResetTransformCommand } from "./definitions/reset-transform.command";
import { useRotationCommands } from "./definitions/rotation.commands";
import { useSaveFrameCommand } from "./definitions/save-frame.command";
import { useSceneCommands } from "./definitions/scene.commands";

function usePreviewCommandGroups() {
  const { t } = useTranslation();
  const crop = useCropPreviewCommand();
  const saveFrame = useSaveFrameCommand();
  const copyFrame = useCopyFrameCommand();
  const rotations = useRotationCommands();
  const flips = useFlipCommands();
  const reset = useResetTransformCommand();
  const { markerCommands, sceneCommands } = useSceneCommands();
  return [
    defineApplicationCommandGroup(
      "preview-markers-scene",
      t("commands.sections.markersScene"),
      sceneCommands,
    ),
    defineApplicationCommandGroup(
      "preview-markers-navigation",
      t("commands.sections.markers"),
      markerCommands,
    ),
    defineApplicationCommandGroup("preview-frame", t("commands.sections.previewFrame"), [
      saveFrame,
      copyFrame,
    ] as const),
    defineApplicationCommandGroup("preview-transform", t("commands.sections.previewTransform"), [
      crop,
      ...rotations,
      ...flips,
      reset,
    ] as const),
  ] as const;
}

export { usePreviewCommandGroups };

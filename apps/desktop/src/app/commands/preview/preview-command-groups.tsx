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
  const sceneCommands = useSceneCommands();
  return [
    defineApplicationCommandGroup("preview-scenes", t("app.labels.commandSections.scenes"), [
      ...sceneCommands,
    ] as const),
    defineApplicationCommandGroup("preview-frame", t("app.labels.commandSections.previewFrame"), [
      saveFrame,
      copyFrame,
    ] as const),
    defineApplicationCommandGroup(
      "preview-transform",
      t("app.labels.commandSections.previewTransform"),
      [crop, ...rotations, ...flips, reset] as const,
    ),
  ] as const;
}

export { usePreviewCommandGroups };

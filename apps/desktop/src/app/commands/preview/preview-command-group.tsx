import { useTranslation } from "react-i18next";

import { defineApplicationCommandGroup } from "@/app/commands/core/application-command.utils";

import { useCropPreviewCommand } from "./definitions/crop.command";
import { useFlipCommands } from "./definitions/flip.commands";
import { useResetTransformCommand } from "./definitions/reset-transform.command";
import { useRotationCommands } from "./definitions/rotation.commands";

function usePreviewCommandGroup() {
  const { t } = useTranslation();
  const crop = useCropPreviewCommand();
  const rotations = useRotationCommands();
  const flips = useFlipCommands();
  const reset = useResetTransformCommand();
  return defineApplicationCommandGroup(
    "preview-transform",
    t("app.labels.commandSections.previewTransform"),
    [crop, ...rotations, ...flips, reset] as const,
  );
}

export { usePreviewCommandGroup };

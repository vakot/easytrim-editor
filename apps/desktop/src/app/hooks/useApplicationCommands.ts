import { useTranslation } from "react-i18next";

import {
  APPLICATION_SHORTCUTS,
  type ApplicationCommand,
  type ApplicationCommandSection,
  commandOrigin,
} from "@/app/commands/application-commands";
import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import { selectCropApplied, selectTransformApplied } from "@/app/store/slices/crop-slice";
import { selectActiveEditingInstance } from "@/app/store/slices/editing-instances-slice";
import {
  selectIsChoosingSource,
  selectIsNativeDialogOpen,
} from "@/app/store/slices/import-workflow-slice";
import { selectHasSource, selectSourceReady } from "@/app/store/slices/source-slice";
import { openOptimizedExportDialog, startFastCutRequested } from "@/app/store/thunks/export-thunks";
import {
  chooseSourceRequested,
  closeActiveEditingInstanceRequested,
} from "@/app/store/thunks/source-media-thunks";

function useApplicationCommands(onDeleteRequested: (sourceId: string) => void) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const activeSource = useAppSelector(selectActiveEditingInstance);
  const canExport = useAppSelector(selectSourceReady);
  const hasSource = useAppSelector(selectHasSource);
  const isChoosingSource = useAppSelector(selectIsChoosingSource);
  const isNativeDialogOpen = useAppSelector(selectIsNativeDialogOpen);
  const cropApplied = useAppSelector(selectCropApplied);
  const transformApplied = useAppSelector(selectTransformApplied);
  const canChooseSource = !isChoosingSource && !isNativeDialogOpen;
  const canUseSource = hasSource && canChooseSource;
  const canSave = canExport && !cropApplied && !transformApplied;

  const sections = {
    export: { id: "export", label: t("app.labels.commandSections.export") },
    file: { id: "file", label: t("app.labels.commandSections.file") },
    source: { id: "source", label: t("app.labels.commandSections.source") },
  } as const satisfies Record<string, ApplicationCommandSection>;

  const commands: ApplicationCommand[] = [
    {
      enabled: canChooseSource,
      execute(surface) {
        void dispatch(chooseSourceRequested(commandOrigin("open-file", surface)));
      },
      id: "open-file",
      label: t("app.actions.openFile"),
      searchTerms: commandSearchTerms(t("app.options.commandSearchTerms.openFile")),
      section: sections.file,
      shortcut: APPLICATION_SHORTCUTS.openFile,
    },
    {
      enabled: canChooseSource,
      execute(surface) {
        void dispatch(chooseSourceRequested(commandOrigin("open-folder", surface), "folders"));
      },
      id: "open-folder",
      label: t("app.actions.openFolder"),
      searchTerms: commandSearchTerms(t("app.options.commandSearchTerms.openFolder")),
      section: sections.file,
    },
    {
      enabled: canUseSource,
      execute(surface) {
        void dispatch(closeActiveEditingInstanceRequested(commandOrigin("close-file", surface)));
      },
      id: "close-file",
      label: t("app.actions.closeFile"),
      searchTerms: commandSearchTerms(t("app.options.commandSearchTerms.closeFile")),
      section: sections.source,
      shortcut: APPLICATION_SHORTCUTS.closeFile,
    },
    {
      enabled: canUseSource && Boolean(activeSource),
      execute() {
        if (activeSource) onDeleteRequested(activeSource.id);
      },
      id: "delete-file",
      label: t("app.actions.deleteFile"),
      searchTerms: commandSearchTerms(t("app.options.commandSearchTerms.deleteFile")),
      section: sections.source,
      shortcut: APPLICATION_SHORTCUTS.deleteFile,
    },
    {
      enabled: canSave,
      execute(surface) {
        void dispatch(startFastCutRequested(commandOrigin("save-lossless-cut", surface)));
      },
      id: "save-lossless-cut",
      label: t("export.actions.fast"),
      searchTerms: commandSearchTerms(t("app.options.commandSearchTerms.saveLosslessCut")),
      section: sections.export,
      shortcut: APPLICATION_SHORTCUTS.saveLosslessCut,
    },
    {
      enabled: canExport,
      execute(surface) {
        void dispatch(openOptimizedExportDialog(commandOrigin("optimized-export", surface)));
      },
      id: "optimized-export",
      label: t("export.actions.optimized"),
      searchTerms: commandSearchTerms(t("app.options.commandSearchTerms.optimizedExport")),
      section: sections.export,
      shortcut: APPLICATION_SHORTCUTS.optimizedExport,
    },
  ];

  return commands;
}

function commandSearchTerms(value: string): string[] {
  return value.split("|").map((term) => term.trim());
}

function commandsById(commands: readonly ApplicationCommand[]) {
  return Object.fromEntries(commands.map((command) => [command.id, command])) as Record<
    ApplicationCommand["id"],
    ApplicationCommand
  >;
}

export { commandsById, useApplicationCommands };

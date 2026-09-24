import {
  FileInputIcon,
  FolderOpenIcon,
  ScissorsIcon,
  Settings2,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import {
  commandSearchTerms,
  defineApplicationCommandGroup,
} from "@/app/commands/application-command.utils";
import { commandOrigin } from "@/app/commands/application-command.types";
import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import { selectActiveEditingInstance } from "@/app/store/slices/editing-instances-slice";
import { selectCropApplied, selectTransformApplied } from "@/app/store/slices/crop-slice";
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
import { useSourceDelete } from "@/features/source";

const APPLICATION_SHORTCUTS = {
  closeFile: { code: "KeyQ", key: "Q", modifier: "control" },
  deleteFile: { code: "KeyD", key: "D", modifier: "control" },
  openFile: { code: "KeyO", key: "O", modifier: "control" },
  openFolder: { code: "KeyK", key: "K", modifier: "control" },
  optimizedExport: { code: "KeyE", key: "E", modifier: "control" },
  saveLosslessCut: { code: "KeyS", key: "S", modifier: "control" },
} as const;

function useFileCommandGroup() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { requestSourceDelete } = useSourceDelete();
  const activeSource = useAppSelector(selectActiveEditingInstance);
  const canExport = useAppSelector(selectSourceReady);
  const cropApplied = useAppSelector(selectCropApplied);
  const transformApplied = useAppSelector(selectTransformApplied);
  const hasSource = useAppSelector(selectHasSource);
  const isChoosingSource = useAppSelector(selectIsChoosingSource);
  const isNativeDialogOpen = useAppSelector(selectIsNativeDialogOpen);
  const canChooseSource = !isChoosingSource && !isNativeDialogOpen;
  const canUseSource = hasSource && canChooseSource;
  const canSave = canExport && !cropApplied && !transformApplied;
  const file = useMemo(
    () => ({ id: "file", label: t("app.labels.commandSections.file") }),
    [t],
  );
  const exportSection = useMemo(
    () => ({ id: "export", label: t("app.labels.commandSections.export") }),
    [t],
  );

  return useMemo(
    () =>
      defineApplicationCommandGroup("file", [
        {
          enabled: canChooseSource,
          icon: <FileInputIcon aria-hidden="true" />,
          async run({ surface }) {
            await dispatch(chooseSourceRequested(commandOrigin("open-file", surface)));
          },
          id: "open-file",
          label: t("app.actions.openFile"),
          searchTerms: commandSearchTerms(t("app.options.commandSearchTerms.openFile")),
          section: file,
          shortcut: APPLICATION_SHORTCUTS.openFile,
          variant: "default",
        },
        {
          enabled: canChooseSource,
          icon: <FolderOpenIcon aria-hidden="true" />,
          async run({ surface }) {
            await dispatch(chooseSourceRequested(commandOrigin("open-folder", surface), "folders"));
          },
          id: "open-folder",
          label: t("app.actions.openFolder"),
          searchTerms: commandSearchTerms(t("app.options.commandSearchTerms.openFolder")),
          section: file,
          shortcut: APPLICATION_SHORTCUTS.openFolder,
          variant: "default",
        },
        {
          enabled: canUseSource,
          icon: <XIcon aria-hidden="true" />,
          async run({ surface }) {
            await dispatch(
              closeActiveEditingInstanceRequested(commandOrigin("close-file", surface)),
            );
          },
          id: "close-file",
          label: t("app.actions.closeFile"),
          searchTerms: commandSearchTerms(t("app.options.commandSearchTerms.closeFile")),
          section: file,
          shortcut: APPLICATION_SHORTCUTS.closeFile,
          variant: "default",
        },
        {
          enabled: canUseSource && Boolean(activeSource),
          icon: <Trash2Icon aria-hidden="true" />,
          run() {
            if (activeSource) requestSourceDelete({ sourceIds: [activeSource.id] });
          },
          id: "delete-file",
          label: t("app.actions.deleteFile"),
          searchTerms: commandSearchTerms(t("app.options.commandSearchTerms.deleteFile")),
          section: file,
          shortcut: APPLICATION_SHORTCUTS.deleteFile,
          variant: "destructive",
        },
        {
          enabled: canSave,
          icon: <ScissorsIcon aria-hidden="true" />,
          async run({ surface }) {
            await dispatch(startFastCutRequested(commandOrigin("save-lossless-cut", surface)));
          },
          id: "save-lossless-cut",
          label: t("export.actions.fast"),
          searchTerms: commandSearchTerms(t("app.options.commandSearchTerms.saveLosslessCut")),
          section: exportSection,
          shortcut: APPLICATION_SHORTCUTS.saveLosslessCut,
          variant: "default",
        },
        {
          enabled: canExport,
          icon: <Settings2 aria-hidden="true" />,
          async run({ surface }) {
            await dispatch(openOptimizedExportDialog(commandOrigin("optimized-export", surface)));
          },
          id: "optimized-export",
          label: t("export.actions.optimized"),
          searchTerms: commandSearchTerms(t("app.options.commandSearchTerms.optimizedExport")),
          section: exportSection,
          shortcut: APPLICATION_SHORTCUTS.optimizedExport,
          variant: "default",
        },
      ]),
    [
      activeSource,
      canChooseSource,
      canExport,
      canSave,
      canUseSource,
      dispatch,
      file,
      exportSection,
      requestSourceDelete,
      t,
    ],
  );
}

export { useFileCommandGroup };

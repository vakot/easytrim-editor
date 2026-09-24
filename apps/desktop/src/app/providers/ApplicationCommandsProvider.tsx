import { type ReactNode, useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  APPLICATION_SHORTCUTS,
  type ApplicationCommand,
  type ApplicationCommandDefinition,
  type ApplicationCommandId,
  type ApplicationCommandSection,
  type ApplicationCommandSurface,
  commandOrigin,
  commandsById,
  commandSearchTerms,
  materializeApplicationCommands,
} from "@/app/commands/application-commands";
import { ApplicationCommandsContext } from "@/app/contexts/application-commands-context";
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
import { useSourceDelete } from "@/features/source";
import { diagnostics } from "@/lib/diagnostics";

function ApplicationCommandsProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { requestSourceDelete } = useSourceDelete();
  const activeSource = useAppSelector(selectActiveEditingInstance);
  const canExport = useAppSelector(selectSourceReady);
  const hasSource = useAppSelector(selectHasSource);
  const isChoosingSource = useAppSelector(selectIsChoosingSource);
  const isNativeDialogOpen = useAppSelector(selectIsNativeDialogOpen);
  const cropApplied = useAppSelector(selectCropApplied);
  const transformApplied = useAppSelector(selectTransformApplied);

  const [pendingIds, setPendingIds] = useState<ReadonlySet<ApplicationCommandId>>(() => new Set());
  const pendingIdsRef = useRef(new Set<ApplicationCommandId>());
  const canChooseSource = !isChoosingSource && !isNativeDialogOpen;
  const canUseSource = hasSource && canChooseSource;
  const canSave = canExport && !cropApplied && !transformApplied;

  const sections = useMemo(
    () =>
      ({
        export: { id: "export", label: t("app.labels.commandSections.export") },
        file: { id: "file", label: t("app.labels.commandSections.file") },
        source: { id: "source", label: t("app.labels.commandSections.source") },
      }) as const satisfies Record<string, ApplicationCommandSection>,
    [t],
  );

  const definitions = useMemo<readonly ApplicationCommandDefinition[]>(
    () => [
      {
        enabled: canChooseSource,
        async run({ surface }) {
          await dispatch(chooseSourceRequested(commandOrigin("open-file", surface)));
        },
        id: "open-file",
        label: t("app.actions.openFile"),
        searchTerms: commandSearchTerms(t("app.options.commandSearchTerms.openFile")),
        section: sections.file,
        shortcut: APPLICATION_SHORTCUTS.openFile,
        variant: "default",
      },
      {
        enabled: canChooseSource,
        async run({ surface }) {
          await dispatch(chooseSourceRequested(commandOrigin("open-folder", surface), "folders"));
        },
        id: "open-folder",
        label: t("app.actions.openFolder"),
        searchTerms: commandSearchTerms(t("app.options.commandSearchTerms.openFolder")),
        section: sections.file,
        shortcut: APPLICATION_SHORTCUTS.openFolder,
        variant: "default",
      },
      {
        enabled: canUseSource,
        async run({ surface }) {
          await dispatch(closeActiveEditingInstanceRequested(commandOrigin("close-file", surface)));
        },
        id: "close-file",
        label: t("app.actions.closeFile"),
        searchTerms: commandSearchTerms(t("app.options.commandSearchTerms.closeFile")),
        section: sections.source,
        shortcut: APPLICATION_SHORTCUTS.closeFile,
        variant: "default",
      },
      {
        enabled: canUseSource && Boolean(activeSource),
        run() {
          if (activeSource) requestSourceDelete({ sourceIds: [activeSource.id] });
        },
        id: "delete-file",
        label: t("app.actions.deleteFile"),
        searchTerms: commandSearchTerms(t("app.options.commandSearchTerms.deleteFile")),
        section: sections.source,
        shortcut: APPLICATION_SHORTCUTS.deleteFile,
        variant: "destructive",
      },
      {
        enabled: canSave,
        async run({ surface }) {
          await dispatch(startFastCutRequested(commandOrigin("save-lossless-cut", surface)));
        },
        id: "save-lossless-cut",
        label: t("export.actions.fast"),
        searchTerms: commandSearchTerms(t("app.options.commandSearchTerms.saveLosslessCut")),
        section: sections.export,
        shortcut: APPLICATION_SHORTCUTS.saveLosslessCut,
        variant: "default",
      },
      {
        enabled: canExport,
        async run({ surface }) {
          await dispatch(openOptimizedExportDialog(commandOrigin("optimized-export", surface)));
        },
        id: "optimized-export",
        label: t("export.actions.optimized"),
        searchTerms: commandSearchTerms(t("app.options.commandSearchTerms.optimizedExport")),
        section: sections.export,
        shortcut: APPLICATION_SHORTCUTS.optimizedExport,
        variant: "default",
      },
    ],
    [
      activeSource,
      canChooseSource,
      canExport,
      canSave,
      canUseSource,
      dispatch,
      requestSourceDelete,
      sections,
      t,
    ],
  );

  const definitionsById = useMemo(() => commandsById(definitions), [definitions]);

  const executeCommand = useCallback(
    async (id: ApplicationCommandId, surface: ApplicationCommandSurface) => {
      const definition = definitionsById[id];
      if (!definition.enabled || pendingIdsRef.current.has(id)) return;

      pendingIdsRef.current.add(id);
      setPendingIds(new Set(pendingIdsRef.current));

      try {
        await definition.run({ surface });
      } catch (error: unknown) {
        diagnostics.error("application.command.failed", error, {
          data: { commandId: id, surface },
          origin: commandOrigin(id, surface),
        });
      } finally {
        pendingIdsRef.current.delete(id);
        setPendingIds(new Set(pendingIdsRef.current));
      }
    },
    [definitionsById],
  );

  const commands = useMemo<readonly ApplicationCommand[]>(
    () => materializeApplicationCommands(definitions, pendingIds),
    [definitions, pendingIds],
  );

  const runtime = useMemo(
    () => ({ commands, commandsById: commandsById(commands), executeCommand }),
    [commands, executeCommand],
  );

  return (
    <ApplicationCommandsContext.Provider value={runtime}>
      {children}
    </ApplicationCommandsContext.Provider>
  );
}

export { ApplicationCommandsProvider };

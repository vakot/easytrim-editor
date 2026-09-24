import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { usePanelCommand } from "@/components/ui/resizable";

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
import { useAppUpdates } from "@/app/hooks/useAppUpdates";
import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  flipToggled,
  rotationChanged,
  selectCropApplied,
  selectFlipHorizontal,
  selectFlipVertical,
  selectRotationDegrees,
  selectTransformApplied,
} from "@/app/store/slices/crop-slice";
import { selectActiveEditingInstance } from "@/app/store/slices/editing-instances-slice";
import {
  queueFinishActionChanged,
  selectAvailableQueueFinishActions,
  selectQueueFinishAction,
} from "@/app/store/slices/export-slice";
import {
  selectIsChoosingSource,
  selectIsNativeDialogOpen,
} from "@/app/store/slices/import-workflow-slice";
import {
  activityFeedViewChanged,
  layoutDensityChanged,
  preferenceChanged,
  preferencesReset,
  primaryColorChanged,
  selectActivityFeedView,
  selectAutoStartQueueEnabled,
  selectDeleteSourceOnRenderFinish,
  selectLayoutDensity,
  selectLoopPlaybackEnabledDefault,
  selectMergeAudioEnabledDefault,
  selectSegmentPlaybackEnabledDefault,
  selectSnapPlaybackEnabledDefault,
  selectThemePreference,
  themePreferenceChanged,
} from "@/app/store/slices/preferences-slice";
import { selectHasSource, selectSourceReady } from "@/app/store/slices/source-slice";
import { openOptimizedExportDialog, startFastCutRequested } from "@/app/store/thunks/export-thunks";
import {
  chooseSourceRequested,
  closeActiveEditingInstanceRequested,
  commitActiveEditingInstanceDraft,
} from "@/app/store/thunks/source-media-thunks";
import { PRIMARY_COLORS } from "@/app/theme/theme";
import { useChangelogDialog } from "@/features/changelog";
import { useQueueDeleteSource } from "@/features/export";
import { usePreviewTransform } from "@/features/preview";
import { useSourceDelete } from "@/features/source";
import { getCurrentVersion } from "@/lib/app-version.utils";
import { diagnostics } from "@/lib/diagnostics";
import { openExternalUrl } from "@/lib/open-external-url.utils";
import { revealDiagnosticLogs } from "@/lib/tauri/diagnostics";
import { requestWindowShutdown } from "@/lib/tauri/window";

function ApplicationCommandsProvider({ children }: { children: ReactNode }) {
  const { i18n, t } = useTranslation();
  const dispatch = useAppDispatch();
  const { requestSourceDelete } = useSourceDelete();
  const { requestEnableSourceDeletion } = useQueueDeleteSource();
  const { openChangelog } = useChangelogDialog();
  const { isAvailable: isPreviewAvailable, requestCrop, requestReset } = usePreviewTransform();
  const {
    availableVersion,
    checkForUpdates,
    installUpdate,
    isInstalling,
    status: updateStatus,
  } = useAppUpdates();

  const activeSource = useAppSelector(selectActiveEditingInstance);
  const canExport = useAppSelector(selectSourceReady);
  const hasSource = useAppSelector(selectHasSource);
  const isChoosingSource = useAppSelector(selectIsChoosingSource);
  const isNativeDialogOpen = useAppSelector(selectIsNativeDialogOpen);
  const cropApplied = useAppSelector(selectCropApplied);
  const flipHorizontal = useAppSelector(selectFlipHorizontal);
  const flipVertical = useAppSelector(selectFlipVertical);
  const rotationDegrees = useAppSelector(selectRotationDegrees);
  const transformApplied = useAppSelector(selectTransformApplied);
  const activityFeedView = useAppSelector(selectActivityFeedView);
  const autoStartQueueEnabled = useAppSelector(selectAutoStartQueueEnabled);
  const deleteSourceOnRenderFinish = useAppSelector(selectDeleteSourceOnRenderFinish);
  const layoutDensity = useAppSelector(selectLayoutDensity);
  const loopPlaybackEnabledDefault = useAppSelector(selectLoopPlaybackEnabledDefault);
  const mergeAudioEnabledDefault = useAppSelector(selectMergeAudioEnabledDefault);
  const segmentPlaybackEnabledDefault = useAppSelector(selectSegmentPlaybackEnabledDefault);
  const snapPlaybackEnabledDefault = useAppSelector(selectSnapPlaybackEnabledDefault);
  const themePreference = useAppSelector(selectThemePreference);
  const primaryColor = useAppSelector((state) => state.preferences.primaryColor);
  const queueFinishAction = useAppSelector(selectQueueFinishAction);
  const availableQueueFinishActions = useAppSelector(selectAvailableQueueFinishActions);

  const leftPanel = usePanelCommand("workspace-sidebar");
  const bottomPanel = usePanelCommand("editor-stage-timeline");
  const layoutPanels = usePanelCommand(["workspace-sidebar", "editor-stage-timeline"]);

  const [pendingIds, setPendingIds] = useState<ReadonlySet<ApplicationCommandId>>(() => new Set());
  const pendingIdsRef = useRef(new Set<ApplicationCommandId>());
  const rotationDegreesRef = useRef(rotationDegrees);
  useEffect(() => {
    rotationDegreesRef.current = rotationDegrees;
  }, [rotationDegrees]);
  const canChooseSource = !isChoosingSource && !isNativeDialogOpen;
  const canUseSource = hasSource && canChooseSource;
  const canSave = canExport && !cropApplied && !transformApplied;
  const themeLabels = {
    dark: t("settings.options.themes.dark"),
    light: t("settings.options.themes.light"),
    system: t("settings.options.themes.system"),
  } as const;

  const colorLabels = {
    amber: t("settings.options.colors.amber"),
    blue: t("settings.options.colors.blue"),
    emerald: t("settings.options.colors.emerald"),
    rose: t("settings.options.colors.rose"),
    violet: t("settings.options.colors.violet"),
  } as const;

  const languageLabels = {
    en: t("settings.options.languages.english"),
    ru: t("settings.options.languages.russian"),
    sk: t("settings.options.languages.slovak"),
  } as const;

  const densityLabels = {
    compact: t("app.options.layoutDensities.compact"),
    default: t("app.options.layoutDensities.default"),
  } as const;

  const activityLabels = {
    branch: t("settings.options.activityFeedViews.branch"),
    compact: t("settings.options.activityFeedViews.compact"),
    default: t("settings.options.activityFeedViews.default"),
  } as const;

  const rotationLabels = {
    rotate180: t("preview.actions.transform.rotate180"),
    rotate90Clockwise: t("preview.actions.transform.rotate90Clockwise"),
    rotate90Counterclockwise: t("preview.actions.transform.rotate90Counterclockwise"),
  } as const;

  const preferenceLabels = {
    autoStartQueueEnabled: t("settings.labels.autoStartQueue"),
    loopPlaybackEnabledDefault: t("settings.options.commandLabels.loop"),
    mergeAudioEnabledDefault: t("settings.options.commandLabels.mergeAudio"),
    segmentPlaybackEnabledDefault: t("settings.options.commandLabels.followSegment"),
    snapPlaybackEnabledDefault: t("settings.options.commandLabels.snap"),
  } as const;

  const sections = useMemo(
    () =>
      ({
        appearanceColor: {
          id: "appearance-color",
          label: t("app.labels.commandSections.appearanceColor"),
        },
        appearanceTheme: {
          id: "appearance-theme",
          label: t("app.labels.commandSections.appearanceTheme"),
        },
        audio: { id: "audio", label: t("app.labels.commandSections.audio") },
        export: { id: "export", label: t("app.labels.commandSections.export") },
        file: { id: "file", label: t("app.labels.commandSections.file") },
        help: { id: "help", label: t("app.labels.commandSections.help") },
        language: { id: "language", label: t("app.labels.commandSections.language") },
        layout: { id: "layout", label: t("app.labels.commandSections.layout") },
        layoutActivityFeedView: {
          id: "layout-activity-feed-view",
          label: t("app.labels.commandSections.layoutActivityFeedView"),
        },
        layoutDensity: {
          id: "layout-density",
          label: t("app.labels.commandSections.layoutDensity"),
        },
        layoutPanelsVisibility: {
          id: "layout-panels-visibility",
          label: t("app.labels.commandSections.layoutPanelsVisibility"),
        },
        playback: { id: "playback", label: t("app.labels.commandSections.playback") },
        preferences: { id: "preferences", label: t("app.labels.commandSections.preferences") },
        preview: { id: "preview", label: t("app.labels.commandSections.preview") },
        queue: { id: "queue", label: t("app.labels.commandSections.queue") },
        queueOnFinished: {
          id: "queue-on-finished",
          label: t("app.labels.commandSections.queueOnFinished"),
        },
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
      {
        enabled: true,
        run: openChangelog,
        id: "open-changelog",
        label: t("support.actions.changelog"),
        searchTerms: commandSearchTerms(
          `${t("support.actions.changelog")}|what's new|release notes`,
        ),
        section: sections.help,
        variant: "default",
      },
      {
        enabled: updateStatus !== "checking" && !isInstalling,
        async run() {
          if (availableVersion) await requestWindowShutdown(installUpdate);
          else await checkForUpdates();
        },
        id: "check-for-updates",
        label:
          updateStatus === "checking"
            ? t("app.status.checkingForUpdates")
            : availableVersion
              ? t("app.actions.update")
              : updateStatus === "up-to-date"
                ? t("app.status.upToDate")
                : t("app.actions.checkForUpdates"),
        searchTerms: commandSearchTerms(`${t("app.actions.checkForUpdates")}|update`),
        section: sections.help,
        variant: updateStatus === "up-to-date" ? "success" : "default",
      },
      {
        enabled: true,
        async run() {
          await openExternalUrl("https://github.com/vakot/easytrim-editor");
        },
        id: "open-project-page",
        label: t("support.actions.projectPage"),
        searchTerms: commandSearchTerms(`${t("support.actions.projectPage")}|github|repository`),
        section: sections.help,
        variant: "default",
      },
      {
        enabled: true,
        async run() {
          await revealDiagnosticLogs();
        },
        id: "show-logs",
        label: t("support.actions.showLogs"),
        searchTerms: commandSearchTerms(`${t("support.actions.showLogs")}|diagnostics|logs`),
        section: sections.help,
        variant: "default",
      },
      {
        enabled: true,
        async run() {
          await openExternalUrl("https://ko-fi.com/vakot");
        },
        id: "support-project",
        label: t("support.actions.projectSupport"),
        searchTerms: commandSearchTerms(`${t("support.actions.projectSupport")}|donate|support`),
        section: sections.help,
        variant: "default",
      },
      {
        enabled: true,
        async run() {
          await openExternalUrl(
            `https://github.com/vakot/easytrim-editor/releases/tag/v${getCurrentVersion()}`,
          );
        },
        id: "open-release-page",
        label: t("app.labels.version", { version: getCurrentVersion() }),
        searchTerms: commandSearchTerms(
          `${t("app.labels.version", { version: getCurrentVersion() })}|release|version`,
        ),
        section: sections.help,
        variant: "default",
      },
      ...(["system", "light", "dark"] as const).map((theme) => ({
        checked: themePreference === theme,
        enabled: true,
        run() {
          dispatch(themePreferenceChanged(theme));
        },
        id: `theme-${theme}` as ApplicationCommandId,
        label: themeLabels[theme],
        searchTerms: commandSearchTerms(`${themeLabels[theme]}|theme|appearance`),
        section: sections.appearanceTheme,
        variant: "default" as const,
      })),
      ...PRIMARY_COLORS.map((color) => ({
        checked: primaryColor === color,
        enabled: true,
        run() {
          dispatch(primaryColorChanged(color));
        },
        id: `primary-color-${color}` as ApplicationCommandId,
        label: colorLabels[color],
        searchTerms: commandSearchTerms(`${colorLabels[color]}|color|accent`),
        section: sections.appearanceColor,
        variant: "default" as const,
      })),
      ...(
        [
          ["auto-start-queue", "autoStartQueueEnabled", autoStartQueueEnabled],
          ["snap-playback", "snapPlaybackEnabledDefault", snapPlaybackEnabledDefault],
          ["loop-playback", "loopPlaybackEnabledDefault", loopPlaybackEnabledDefault],
          ["segment-playback", "segmentPlaybackEnabledDefault", segmentPlaybackEnabledDefault],
          ["merge-audio", "mergeAudioEnabledDefault", mergeAudioEnabledDefault],
        ] as const
      ).map(([id, key, checked]) => ({
        checked,
        enabled: true,
        run() {
          dispatch(preferenceChanged({ key, enabled: !checked }));
        },
        id: `preference-${id}` as ApplicationCommandId,
        label: preferenceLabels[key],
        searchTerms: commandSearchTerms(`${preferenceLabels[key]}|preference|setting`),
        section: key === "mergeAudioEnabledDefault" ? sections.audio : sections.playback,
        variant: "default" as const,
      })),
      {
        enabled: true,
        run() {
          dispatch(preferencesReset());
        },
        id: "reset-preferences",
        label: t("settings.actions.reset"),
        searchTerms: commandSearchTerms(`${t("settings.actions.reset")}|settings|preferences`),
        section: sections.preferences,
        variant: "destructive",
      },
      ...(["en", "sk", "ru"] as const).map((language) => ({
        checked: i18n.resolvedLanguage === language,
        enabled: true,
        async run() {
          await i18n.changeLanguage(language);
        },
        id: `language-${language}` as ApplicationCommandId,
        label: languageLabels[language],
        searchTerms: commandSearchTerms(`${languageLabels[language]}|language`),
        section: sections.language,
        variant: "default" as const,
      })),
      {
        checked: deleteSourceOnRenderFinish,
        enabled: true,
        run() {
          if (deleteSourceOnRenderFinish) {
            dispatch(preferenceChanged({ enabled: false, key: "deleteSourceOnRenderFinish" }));
          } else {
            requestEnableSourceDeletion();
          }
        },
        id: "delete-source-on-render-finish",
        label: t("queue.labels.deleteSource"),
        searchTerms: commandSearchTerms(`${t("queue.labels.deleteSource")}|render|queue`),
        section: sections.queueOnFinished,
        variant: "destructive",
      },
      {
        checked: queueFinishAction === "exit",
        enabled: availableQueueFinishActions.includes("exit"),
        run() {
          dispatch(queueFinishActionChanged("exit"));
        },
        id: "queue-finish-exit",
        label: t("queue.options.finishActions.exit"),
        searchTerms: commandSearchTerms(`${t("queue.options.finishActions.exit")}|queue|finish`),
        section: sections.queueOnFinished,
        variant: "default",
      },
      {
        checked: queueFinishAction === "nothing",
        enabled: availableQueueFinishActions.includes("nothing"),
        run() {
          dispatch(queueFinishActionChanged("nothing"));
        },
        id: "queue-finish-nothing",
        label: t("queue.options.finishActions.nothing"),
        searchTerms: commandSearchTerms(`${t("queue.options.finishActions.nothing")}|queue|finish`),
        section: sections.queueOnFinished,
        variant: "default",
      },
      {
        checked: queueFinishAction === "systemSleep",
        enabled: availableQueueFinishActions.includes("systemSleep"),
        run() {
          dispatch(queueFinishActionChanged("systemSleep"));
        },
        id: "queue-finish-system-sleep",
        label: t("queue.options.finishActions.systemSleep"),
        searchTerms: commandSearchTerms(
          `${t("queue.options.finishActions.systemSleep")}|queue|finish`,
        ),
        section: sections.queueOnFinished,
        variant: "default",
      },
      {
        checked: queueFinishAction === "systemShutdown",
        enabled: availableQueueFinishActions.includes("systemShutdown"),
        run() {
          dispatch(queueFinishActionChanged("systemShutdown"));
        },
        id: "queue-finish-system-shutdown",
        label: t("queue.options.finishActions.systemShutdown"),
        searchTerms: commandSearchTerms(
          `${t("queue.options.finishActions.systemShutdown")}|queue|finish`,
        ),
        section: sections.queueOnFinished,
        variant: "default",
      },
      {
        checked: !leftPanel.isCollapsed,
        enabled: leftPanel.isAvailable,
        run: leftPanel.toggle,
        id: "toggle-left-panel",
        label: t("app.actions.showPanel", { panel: t("app.labels.leftPanel") }),
        searchTerms: commandSearchTerms(`${t("app.labels.leftPanel")}|panel|sidebar`),
        section: sections.layoutPanelsVisibility,
        variant: "default",
      },
      {
        checked: !bottomPanel.isCollapsed,
        enabled: bottomPanel.isAvailable,
        run: bottomPanel.toggle,
        id: "toggle-bottom-panel",
        label: t("app.actions.showPanel", { panel: t("app.labels.bottomPanel") }),
        searchTerms: commandSearchTerms(`${t("app.labels.bottomPanel")}|panel|timeline`),
        section: sections.layoutPanelsVisibility,
        variant: "default",
      },
      ...(["default", "compact"] as const).map((density) => ({
        checked: layoutDensity === density,
        enabled: true,
        run() {
          dispatch(layoutDensityChanged(density));
        },
        id: `layout-density-${density}` as ApplicationCommandId,
        label: densityLabels[density],
        searchTerms: commandSearchTerms(`${densityLabels[density]}|layout|density`),
        section: sections.layoutDensity,
        variant: "default" as const,
      })),
      ...(["default", "compact", "branch"] as const).map((view) => ({
        checked: activityFeedView === view,
        enabled: true,
        run() {
          dispatch(activityFeedViewChanged(view));
        },
        id: `activity-feed-view-${view}` as ApplicationCommandId,
        label: activityLabels[view],
        searchTerms: commandSearchTerms(`${activityLabels[view]}|activity|feed`),
        section: sections.layoutActivityFeedView,
        variant: "default" as const,
      })),
      {
        enabled: layoutPanels.isAvailable && !layoutPanels.isReset,
        run: layoutPanels.reset,
        id: "reset-layout",
        label: t("app.actions.resetLayout"),
        searchTerms: commandSearchTerms(`${t("app.actions.resetLayout")}|layout|panels`),
        section: sections.layout,
        variant: "default",
      },
      {
        enabled: isPreviewAvailable,
        run: requestCrop,
        id: "crop-preview",
        label: t("preview.actions.transform.crop"),
        searchTerms: commandSearchTerms(`${t("preview.actions.transform.crop")}|crop|transform`),
        section: sections.preview,
        variant: "default",
      },
      ...(
        [
          ["rotate-90-cw", "rotate90Clockwise", 90],
          ["rotate-90-ccw", "rotate90Counterclockwise", -90],
          ["rotate-180", "rotate180", 180],
        ] as const
      ).map(([id, labelKey, delta]) => ({
        checked: rotationDegrees === (delta + 360) % 360,
        enabled: isPreviewAvailable,
        run() {
          const nextRotation = ((rotationDegreesRef.current + delta + 360) % 360) as
            0 | 90 | 180 | 270;

          dispatch(rotationChanged(nextRotation));
          dispatch(commitActiveEditingInstanceDraft());
        },

        id: id as ApplicationCommandId,
        label: rotationLabels[labelKey],
        searchTerms: commandSearchTerms(`${rotationLabels[labelKey]}|rotate|transform`),
        section: sections.preview,
        variant: "default" as const,
      })),
      {
        checked: flipHorizontal,
        enabled: isPreviewAvailable,
        run() {
          dispatch(flipToggled("horizontal"));
          dispatch(commitActiveEditingInstanceDraft());
        },
        id: "flip-horizontal",
        label: t("preview.actions.transform.flipHorizontal"),
        searchTerms: commandSearchTerms(
          `${t("preview.actions.transform.flipHorizontal")}|flip|transform`,
        ),
        section: sections.preview,
        variant: "default",
      },
      {
        checked: flipVertical,
        enabled: isPreviewAvailable,
        run() {
          dispatch(flipToggled("vertical"));
          dispatch(commitActiveEditingInstanceDraft());
        },
        id: "flip-vertical",
        label: t("preview.actions.transform.flipVertical"),
        searchTerms: commandSearchTerms(
          `${t("preview.actions.transform.flipVertical")}|flip|transform`,
        ),
        section: sections.preview,
        variant: "default",
      },
      {
        enabled: isPreviewAvailable,
        run: requestReset,
        id: "reset-transform",
        label: t("preview.actions.transform.reset"),
        searchTerms: commandSearchTerms(`${t("preview.actions.transform.reset")}|reset|transform`),
        section: sections.preview,
        variant: "destructive",
      },
    ],
    // Label maps are derived from `t`; the translation function remains a dependency below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      activeSource,
      activityFeedView,
      availableQueueFinishActions,
      availableVersion,
      autoStartQueueEnabled,
      bottomPanel,
      canChooseSource,
      canExport,
      canSave,
      canUseSource,
      checkForUpdates,
      deleteSourceOnRenderFinish,
      dispatch,
      flipHorizontal,
      flipVertical,
      i18n,
      installUpdate,
      isInstalling,
      isPreviewAvailable,
      layoutDensity,
      layoutPanels,
      leftPanel,
      loopPlaybackEnabledDefault,
      mergeAudioEnabledDefault,
      openChangelog,
      primaryColor,
      queueFinishAction,
      requestSourceDelete,
      requestCrop,
      requestEnableSourceDeletion,
      requestReset,
      rotationDegrees,
      sections,
      segmentPlaybackEnabledDefault,
      snapPlaybackEnabledDefault,
      themePreference,
      t,
      updateStatus,
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
        const result = definition.run({ surface });
        if (result && typeof result.then === "function") await result;
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

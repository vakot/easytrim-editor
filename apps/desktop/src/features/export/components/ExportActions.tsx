import { List, MoreHorizontal, Scissors, Settings2 } from "lucide-react";
import type { ComponentProps } from "react";
import { useTranslation } from "react-i18next";

import { Badge } from "@easytrim-editor/ui/badge";
import { Button } from "@easytrim-editor/ui/button";
import { cn } from "@easytrim-editor/ui/class-names";
import { Tooltip, TooltipContent, TooltipTrigger } from "@easytrim-editor/ui/tooltip";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import type { ApplicationShortcut } from "@/app/commands/core/application-command.types";
import { getShortcutAriaValue } from "@/app/commands/core/application-command.utils";
import {
  FAST_EXPORT_SHORTCUT,
  OPTIMIZED_EXPORT_SHORTCUT,
} from "@/app/commands/file/file-shortcuts.constants";
import {
  ApplicationCommandIcon,
  ApplicationCommandShortcut,
} from "@/app/components/ApplicationCommandMenuItem";
import { ShortcutTooltipContent } from "@/app/components/ShortcutTooltipContent";
import { useApplicationCommand, useApplicationCommands } from "@/app/hooks/useApplicationCommands";
import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import { selectAudioTracks } from "@/app/store/slices/audio-slice";
import { selectCropApplied, selectTransformApplied } from "@/app/store/slices/crop-slice";
import { selectExportQueueSummary } from "@/app/store/slices/editing-instances-slice";
import { selectSourceReady } from "@/app/store/slices/source-slice";
import { preloadOnIntent } from "@/lib/lazy-component";

import { ExportDialog, ExportDialogTrigger } from "../dialogs/ExportDialog";

const preloadExportDialogOnIntent = preloadOnIntent(() => ExportDialog.preload());

function ExportActions() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  const sourceReady = useAppSelector(selectSourceReady);
  const hasSelectedAudio = useAppSelector((state) =>
    selectAudioTracks(state).some((track) => track.enabled),
  );

  const cropApplied = useAppSelector(selectCropApplied);
  const transformApplied = useAppSelector(selectTransformApplied);
  const queueSummary = useAppSelector(selectExportQueueSummary);
  const finishedExports = queueSummary.completed + queueSummary.failed;
  const queueSize = finishedExports + queueSummary.queued + queueSummary.rendering;

  const fastExportAvailable = sourceReady && !cropApplied && !transformApplied;

  return (
    <div
      aria-label={t("export.actions.accessibleLabel")}
      className="flex shrink-0 items-center gap-1"
      role="toolbar"
    >
      <ExportActionTooltip tooltip={t("queue.actions.openExportQueue")}>
        <ExportQueueTrigger finishedExports={finishedExports} queueSize={queueSize} />
      </ExportActionTooltip>

      <ExportActionTooltip
        disabled={!fastExportAvailable}
        shortcut={FAST_EXPORT_SHORTCUT}
        tooltip={
          sourceReady && !fastExportAvailable
            ? t("export.fastExport.unavailable")
            : t("export.fastExport.tooltip")
        }
      >
        <ExportActionButton
          aria-keyshortcuts={getShortcutAriaValue(FAST_EXPORT_SHORTCUT)}
          disabled={!fastExportAvailable}
          icon={<Scissors aria-hidden="true" />}
          onClick={() => {
            void import("@/app/store/thunks/export-thunks").then(({ startFastExportRequested }) =>
              dispatch(startFastExportRequested({ id: "toolbar.fast-export", type: "button" })),
            );
          }}
        >
          {t("export.fastExport.action")}
        </ExportActionButton>
      </ExportActionTooltip>

      <ExportActionTooltip
        disabled={!sourceReady}
        shortcut={OPTIMIZED_EXPORT_SHORTCUT}
        tooltip={t("export.optimized.tooltip")}
      >
        <ExportDialogTrigger asChild>
          <ExportActionButton
            aria-keyshortcuts={getShortcutAriaValue(OPTIMIZED_EXPORT_SHORTCUT)}
            disabled={!sourceReady}
            icon={<Settings2 aria-hidden="true" />}
          >
            {t("export.optimized.action")}
          </ExportActionButton>
        </ExportDialogTrigger>
      </ExportActionTooltip>

      <MoreExportActionsDropdown hasSelectedAudio={hasSelectedAudio} sourceReady={sourceReady} />
    </div>
  );
}

function ExportQueueTrigger({
  finishedExports,
  queueSize,
}: {
  finishedExports: number;
  queueSize: number;
}) {
  const { t } = useTranslation();
  const command = useApplicationCommand("open-workspace-view-exportQueue");
  const { executeCommand } = useApplicationCommands();

  return (
    <ExportActionButton
      className="max-2xl:size-auto max-2xl:h-7 max-2xl:gap-1 max-2xl:px-2"
      icon={<List aria-hidden="true" />}
      indicator={
        <Badge size="xs" variant="secondary">
          {finishedExports}/{queueSize}
        </Badge>
      }
      onClick={() => void executeCommand(command.id, "button")}
      onFocus={command.preload}
      onPointerEnter={command.preload}
      variant="default"
    >
      {t("queue.title")}
    </ExportActionButton>
  );
}

function MoreExportActionsDropdown({
  hasSelectedAudio,
  sourceReady,
}: {
  hasSelectedAudio: boolean;
  sourceReady: boolean;
}) {
  const { t } = useTranslation();
  const audioExport = useApplicationCommand("audio-export");
  const gifExport = useApplicationCommand("gif-export");

  return (
    <Tooltip>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <TooltipTrigger asChild>
            <ExportActionButton icon={<MoreHorizontal aria-hidden="true" />}>
              {t("export.actions.more")}
            </ExportActionButton>
          </TooltipTrigger>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="max-w-[calc(100vw-1rem)]"
          data-export-actions-dropdown=""
          onFocus={preloadExportDialogOnIntent}
          onPointerEnter={preloadExportDialogOnIntent}
        >
          <ExportFormatMenuItem
            command={audioExport}
            disabledReason={
              !hasSelectedAudio
                ? t("export.audioExport.noTracks")
                : !sourceReady
                  ? t("export.actions.sourceRequired")
                  : undefined
            }
            tooltip={t("export.audioExport.tooltip")}
          />
          <ExportFormatMenuItem
            command={gifExport}
            disabledReason={!sourceReady ? t("export.actions.sourceRequired") : undefined}
            tooltip={t("export.gif.tooltip")}
          />
        </DropdownMenuContent>
      </DropdownMenu>
      <TooltipContent>{t("export.actions.moreFormats")}</TooltipContent>
    </Tooltip>
  );
}

function ExportFormatMenuItem({
  command,
  disabledReason,
  tooltip,
}: {
  command: ReturnType<typeof useApplicationCommand>;
  disabledReason?: string;
  tooltip: string;
}) {
  const { executeCommand } = useApplicationCommands();
  const disabled = !command.enabled || command.pending || Boolean(disabledReason);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <DropdownMenuItem
          aria-disabled={disabled}
          className={
            disabled ? "aria-disabled:cursor-not-allowed aria-disabled:opacity-50" : undefined
          }
          onSelect={(event) => {
            if (disabled) {
              event.preventDefault();
              return;
            }
            void executeCommand(command.id, "menu");
          }}
        >
          <ApplicationCommandIcon className="mr-2" command={command} />
          <span>{command.label}</span>
          <ApplicationCommandShortcut command={command} />
        </DropdownMenuItem>
      </TooltipTrigger>
      <TooltipContent side="left">
        {disabled && disabledReason ? disabledReason : tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

function ExportActionButton({
  children,
  className,
  icon,
  indicator,
  variant = "secondary",
  ...props
}: ComponentProps<typeof Button> & {
  icon?: React.ReactNode;
  indicator?: React.ReactNode;
}) {
  return (
    <Button
      className={cn(
        "max-2xl:size-7 max-2xl:gap-0 max-2xl:rounded-[min(var(--radius-md),0.75rem)] max-2xl:p-0",
        className,
      )}
      size="sm"
      type="button"
      variant={variant}
      {...props}
    >
      {icon}
      {indicator}
      <span className="inline-flex items-center gap-1 truncate max-2xl:sr-only">{children}</span>
    </Button>
  );
}

function ExportActionTooltip({
  children,
  disabled,
  shortcut,
  tooltip,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  shortcut?: ApplicationShortcut;
  tooltip: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex" tabIndex={disabled ? 0 : undefined}>
          {children}
        </span>
      </TooltipTrigger>
      {shortcut ? (
        <ShortcutTooltipContent shortcut={shortcut} title={tooltip} />
      ) : (
        <TooltipContent>{tooltip}</TooltipContent>
      )}
    </Tooltip>
  );
}

export { ExportActions };

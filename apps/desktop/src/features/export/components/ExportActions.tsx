import { List, MoreHorizontal, Scissors, Settings2 } from "lucide-react";
import type { ComponentProps } from "react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

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
import {
  exportQueueDialogClosed,
  exportQueueDialogOpened,
  selectExportQueueDialogOpen,
} from "@/app/store/slices/export-slice";
import {
  preferenceChanged,
  selectStripMetadataOnExport,
} from "@/app/store/slices/preferences-slice";
import { selectSourceReady } from "@/app/store/slices/source-slice";
import {
  openOptimizedExportDialog,
  startExportQueue,
  startFastExportRequested,
} from "@/app/store/thunks/export-thunks";
import { cn } from "@/lib/class-names.utils";

import { ExportQueue, ExportQueueContent, ExportQueueSummary } from "../components/ExportQueue";
import { useExportQueue } from "../components/ExportQueue/contexts/ExportQueueContext";

function ExportActions() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  const exportQueueDialogOpen = useAppSelector(selectExportQueueDialogOpen);
  const sourceReady = useAppSelector(selectSourceReady);
  const hasSelectedAudio = useAppSelector((state) =>
    selectAudioTracks(state).some((track) => track.enabled),
  );

  const cropApplied = useAppSelector(selectCropApplied);
  const transformApplied = useAppSelector(selectTransformApplied);
  const queueSummary = useAppSelector(selectExportQueueSummary);
  const stripMetadataOnExport = useAppSelector(selectStripMetadataOnExport);
  const finishedExports = queueSummary.completed + queueSummary.failed;
  const queueSize = finishedExports + queueSummary.queued + queueSummary.rendering;

  const fastExportAvailable = sourceReady && !cropApplied && !transformApplied;

  return (
    <div
      aria-label={t("export.actions.accessibleLabel")}
      className="flex shrink-0 items-center gap-1"
      role="toolbar"
    >
      <Dialog
        onOpenChange={(open) =>
          dispatch(open ? exportQueueDialogOpened() : exportQueueDialogClosed())
        }
        open={exportQueueDialogOpen}
      >
        <ExportQueue>
          <ExportActionTooltip tooltip={t("queue.actions.openExportQueue")}>
            <ExportQueueTrigger finishedExports={finishedExports} queueSize={queueSize} />
          </ExportActionTooltip>

          <DialogContent className="max-h-[min(80dvh,48rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden sm:max-w-lg">
            <DialogHeader className="-mx-4 border-b px-4 pb-4">
              <DialogTitle>{t("queue.title")}</DialogTitle>
              <DialogDescription>
                <ExportQueueSummary />
              </DialogDescription>
            </DialogHeader>

            <ScrollArea className="-mx-4 min-h-0 px-4" data-testid="export-queue-scroll-area">
              <ExportQueueContent className="py-2" />
            </ScrollArea>

            <DialogFooter className="sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={stripMetadataOnExport}
                  id="queue-strip-metadata"
                  onCheckedChange={(checked) =>
                    dispatch(
                      preferenceChanged({
                        key: "stripMetadataOnExport",
                        enabled: checked === true,
                      }),
                    )
                  }
                />
                <Label
                  className="text-sm font-normal text-muted-foreground"
                  htmlFor="queue-strip-metadata"
                >
                  {t("settings.preferences.stripMetadata.commandLabel")}
                </Label>
              </div>
              <div className="flex items-center justify-end gap-2">
                <DialogClose asChild>
                  <Button variant="outline">{t("common.actions.close")}</Button>
                </DialogClose>
                <ExportQueueStartButton />
              </div>
            </DialogFooter>
          </DialogContent>
        </ExportQueue>
      </Dialog>

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
          onClick={() =>
            void dispatch(startFastExportRequested({ id: "toolbar.fast-export", type: "button" }))
          }
        >
          {t("export.fastExport.action")}
        </ExportActionButton>
      </ExportActionTooltip>

      <ExportActionTooltip
        disabled={!sourceReady}
        shortcut={OPTIMIZED_EXPORT_SHORTCUT}
        tooltip={t("export.optimized.tooltip")}
      >
        <ExportActionButton
          aria-keyshortcuts={getShortcutAriaValue(OPTIMIZED_EXPORT_SHORTCUT)}
          disabled={!sourceReady}
          icon={<Settings2 aria-hidden="true" />}
          onClick={() =>
            void dispatch(
              openOptimizedExportDialog({ id: "toolbar.optimized-export", type: "button" }),
            )
          }
        >
          {t("export.optimized.action")}
        </ExportActionButton>
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

  return (
    <DialogTrigger asChild>
      <ExportActionButton
        className="max-2xl:size-auto max-2xl:h-7 max-2xl:gap-1 max-2xl:px-2"
        icon={<List aria-hidden="true" />}
        indicator={
          <Badge size="xs" variant="secondary">
            {finishedExports}/{queueSize}
          </Badge>
        }
        variant="default"
      >
        {t("queue.title")}
      </ExportActionButton>
    </DialogTrigger>
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
        <DropdownMenuContent align="end" className="max-w-[calc(100vw-1rem)]">
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
      <TooltipContent side="left">{t("export.actions.moreFormats")}</TooltipContent>
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

function ExportQueueStartButton() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { summary } = useExportQueue();

  return (
    <Button
      disabled={summary.queued === 0}
      onClick={() => void dispatch(startExportQueue())}
      type="button"
    >
      {t("queue.actions.startQueue")}
    </Button>
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
        <ShortcutTooltipContent shortcut={shortcut} side="left" title={tooltip} />
      ) : (
        <TooltipContent side="left">{tooltip}</TooltipContent>
      )}
    </Tooltip>
  );
}

export { ExportActions };

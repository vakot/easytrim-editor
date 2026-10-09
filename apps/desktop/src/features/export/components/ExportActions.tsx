import { AudioLines, Film, List, Scissors, Settings2 } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import type { ApplicationShortcut } from "@/app/commands/core/application-command.types";
import { getShortcutAriaValue } from "@/app/commands/core/application-command.utils";
import {
  FAST_EXPORT_SHORTCUT,
  GIF_EXPORT_SHORTCUT,
  OPTIMIZED_EXPORT_SHORTCUT,
} from "@/app/commands/file/file-shortcuts.constants";
import { ShortcutTooltipContent } from "@/app/components/ShortcutTooltipContent";
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
  openGifExportDialog,
  openOptimizedExportDialog,
  startAudioExportRequested,
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
          <ExportQueueTrigger finishedExports={finishedExports} queueSize={queueSize} />

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

      <ExportActionTooltip
        disabled={!sourceReady || !hasSelectedAudio}
        tooltip={
          hasSelectedAudio ? t("export.audioExport.tooltip") : t("export.audioExport.noTracks")
        }
      >
        <ExportActionButton
          disabled={!sourceReady || !hasSelectedAudio}
          icon={<AudioLines aria-hidden="true" />}
          onClick={() => void dispatch(startAudioExportRequested())}
        >
          {t("export.audioExport.action")}
        </ExportActionButton>
      </ExportActionTooltip>
      <ExportActionTooltip
        disabled={!sourceReady}
        shortcut={GIF_EXPORT_SHORTCUT}
        tooltip={t("export.gif.tooltip")}
      >
        <ExportActionButton
          aria-keyshortcuts={getShortcutAriaValue(GIF_EXPORT_SHORTCUT)}
          disabled={!sourceReady}
          icon={<Film aria-hidden="true" />}
          onClick={() =>
            void dispatch(openGifExportDialog({ id: "toolbar.gif-export", type: "button" }))
          }
        >
          {t("export.gif.action")}
        </ExportActionButton>
      </ExportActionTooltip>
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
        <ShortcutTooltipContent shortcut={shortcut} title={tooltip} />
      ) : (
        <TooltipContent>{tooltip}</TooltipContent>
      )}
    </Tooltip>
  );
}

export { ExportActions };

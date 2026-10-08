import { AudioLines, List, Scissors, Settings2 } from "lucide-react";
import { motion, useAnimationControls, useReducedMotion } from "motion/react";
import type { ComponentProps } from "react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipTrigger } from "@/components/ui/tooltip";

import type { ApplicationShortcut } from "@/app/commands/core/application-command.types";
import { getShortcutAriaValue } from "@/app/commands/core/application-command.utils";
import {
  FAST_EXPORT_SHORTCUT,
  OPTIMIZED_EXPORT_SHORTCUT,
} from "@/app/commands/file/file-shortcuts.constants";
import { ShortcutTooltipContent } from "@/app/components/ShortcutTooltipContent";
import { useAppDispatch, useAppSelector, useAppStore } from "@/app/store/redux-hooks";
import { selectAudioTracks } from "@/app/store/slices/audio-slice";
import { selectCropApplied, selectTransformApplied } from "@/app/store/slices/crop-slice";
import {
  selectExportQueue,
  selectExportQueueSummary,
} from "@/app/store/slices/editing-instances-slice";
import {
  exportQueueDialogClosed,
  exportQueueDialogOpened,
  selectExportQueueDialogOpen,
} from "@/app/store/slices/export-slice";
import { selectSourceReady } from "@/app/store/slices/source-slice";
import {
  openOptimizedExportDialog,
  startAudioExportRequested,
  startExportQueue,
  startFastExportRequested,
} from "@/app/store/thunks/export-thunks";
import { cn } from "@/lib/class-names.utils";

import { ExportQueue, ExportQueueContent, ExportQueueSummary } from "../components/ExportQueue";
import { useExportQueue } from "../components/ExportQueue/contexts/ExportQueueContext";

type ExportQueuePulseTone = "destructive" | "primary" | "success";

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

            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">{t("common.actions.close")}</Button>
              </DialogClose>
              <ExportQueueStartButton />
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

      <ExportActionButton
        disabled={!sourceReady || !hasSelectedAudio}
        icon={<AudioLines aria-hidden="true" />}
        onClick={() => void dispatch(startAudioExportRequested())}
        title={
          hasSelectedAudio ? t("export.audioExport.tooltip") : t("export.audioExport.noTracks")
        }
      >
        {t("export.audioExport.action")}
      </ExportActionButton>
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
  const store = useAppStore();
  const shouldReduceMotion = useReducedMotion();
  const pulseControls = useAnimationControls();

  useEffect(() => {
    let previousStatuses = new Map(
      selectExportQueue(store.getState()).map(({ attempt, instance }) => [
        `${instance.id}:${attempt.id}`,
        attempt.state.status,
      ]),
    );

    return store.subscribe(() => {
      let nextTone: ExportQueuePulseTone | null = null;
      const currentStatuses = new Map(previousStatuses);
      currentStatuses.clear();

      for (const { attempt, instance } of selectExportQueue(store.getState())) {
        const key = `${instance.id}:${attempt.id}`;
        const status = attempt.state.status;
        const previousStatus = previousStatuses.get(key);

        if (previousStatus === undefined && (status === "queued" || status === "rendering")) {
          nextTone ??= "primary";
        } else if (previousStatus !== status) {
          if (status === "failed") nextTone = "destructive";
          else if (status === "completed" && nextTone !== "destructive") nextTone = "success";
          else if (status === "queued") nextTone ??= "primary";
        }

        currentStatuses.set(key, status);
      }

      previousStatuses = currentStatuses;
      if (nextTone && !shouldReduceMotion) {
        const pulseColor = `var(--${nextTone})`;
        void pulseControls.start({
          boxShadow: [
            "0 0 0 0 transparent",
            `0 0 0 0.25rem color-mix(in srgb, ${pulseColor} 35%, transparent)`,
            "0 0 0 0.5rem transparent",
          ],
          transition: { duration: 0.6, ease: "easeOut" },
        });
      }
    });
  }, [pulseControls, shouldReduceMotion, store]);

  return (
    <DialogTrigger asChild>
      <MotionExportActionButton
        animate={pulseControls}
        className="max-2xl:size-auto max-2xl:h-7 max-2xl:gap-1 max-2xl:px-2"
        icon={<List aria-hidden="true" />}
        indicator={
          <Badge size="xs" variant="secondary">
            {finishedExports}/{queueSize}
          </Badge>
        }
        initial={false}
        variant="default"
      >
        {t("queue.title")}
      </MotionExportActionButton>
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

const MotionExportActionButton = motion.create(ExportActionButton);

function ExportActionTooltip({
  children,
  disabled,
  shortcut,
  tooltip,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  shortcut: ApplicationShortcut;
  tooltip: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex" tabIndex={disabled ? 0 : undefined}>
          {children}
        </span>
      </TooltipTrigger>
      <ShortcutTooltipContent shortcut={shortcut} title={tooltip} />
    </Tooltip>
  );
}

export { ExportActions };

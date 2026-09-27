import { List, Scissors, Settings2 } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import type { ComponentProps } from "react";
import { useEffect, useState } from "react";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { useAppDispatch, useAppSelector, useAppStore } from "@/app/store/redux-hooks";
import { selectCropApplied, selectTransformApplied } from "@/app/store/slices/crop-slice";
import {
  selectExportQueue,
  selectExportQueueSummary,
} from "@/app/store/slices/editing-instances-slice";
import { selectSourceReady } from "@/app/store/slices/source-slice";
import {
  openOptimizedExportDialog,
  startExportQueue,
  startFastCutRequested,
} from "@/app/store/thunks/export-thunks";
import { cn } from "@/lib/class-names.utils";

import { ExportQueue, ExportQueueContent, ExportQueueSummary } from "../components/ExportQueue";
import { useExportQueue } from "../components/ExportQueue/contexts/ExportQueueContext";

type ExportQueuePulseTone = "destructive" | "primary" | "success";

function ExportActions() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  const sourceReady = useAppSelector(selectSourceReady);
  const cropApplied = useAppSelector(selectCropApplied);
  const transformApplied = useAppSelector(selectTransformApplied);
  const queueSummary = useAppSelector(selectExportQueueSummary);
  const finishedExports = queueSummary.completed + queueSummary.failed;
  const queueSize = finishedExports + queueSummary.queued + queueSummary.rendering;

  const fastCutAvailable = sourceReady && !cropApplied && !transformApplied;

  return (
    <div
      aria-label={t("export.accessibility.actions")}
      className="flex shrink-0 items-center gap-1"
      role="toolbar"
    >
      <Dialog>
        <ExportQueue>
          <ExportQueueTrigger finishedExports={finishedExports} queueSize={queueSize} />

          <DialogContent className="max-h-[min(80dvh,48rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden sm:max-w-lg">
            <DialogHeader className="-mx-4 border-b px-4 pb-4">
              <DialogTitle>{t("queue.labels.renderQueue")}</DialogTitle>
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
        disabled={!fastCutAvailable}
        tooltip={
          sourceReady && !fastCutAvailable
            ? t("export.messages.fastUnavailable")
            : t("export.tooltips.fast")
        }
      >
        <ExportActionButton
          aria-keyshortcuts="Ctrl+S"
          disabled={!fastCutAvailable}
          icon={<Scissors aria-hidden="true" />}
          onClick={() =>
            void dispatch(startFastCutRequested({ id: "toolbar.fast-export", type: "button" }))
          }
        >
          {t("export.actions.fast")}
        </ExportActionButton>
      </ExportActionTooltip>

      <ExportActionTooltip disabled={!sourceReady} tooltip={t("export.tooltips.optimized")}>
        <ExportActionButton
          aria-keyshortcuts="Ctrl+E"
          disabled={!sourceReady}
          icon={<Settings2 aria-hidden="true" />}
          onClick={() =>
            void dispatch(
              openOptimizedExportDialog({ id: "toolbar.optimized-export", type: "button" }),
            )
          }
        >
          {t("export.actions.optimized")}
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
  const store = useAppStore();
  const shouldReduceMotion = useReducedMotion();
  const [pulse, setPulse] = useState<{ key: number; tone: ExportQueuePulseTone }>({
    key: 0,
    tone: "primary",
  });

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
      if (nextTone) setPulse((current) => ({ key: current.key + 1, tone: nextTone }));
    });
  }, [store]);

  const shouldPulse = pulse.key > 0 && !shouldReduceMotion;
  const pulseColor = `var(--${pulse.tone})`;

  return (
    <ExportActionTooltip tooltip={t("queue.labels.renderQueue")}>
      <DialogTrigger asChild>
        <MotionExportActionButton
          animate={
            shouldPulse
              ? {
                  boxShadow: [
                    "0 0 0 0 transparent",
                    `0 0 0 4px color-mix(in srgb, ${pulseColor} 35%, transparent)`,
                    "0 0 0 8px transparent",
                  ],
                }
              : { boxShadow: "0 0 0 0 transparent" }
          }
          icon={<List aria-hidden="true" />}
          initial={shouldPulse ? { boxShadow: "0 0 0 0 transparent" } : false}
          key={pulse.key}
          transition={{ duration: 0.6, ease: "easeOut" }}
          variant="default"
        >
          <Badge size="xs" variant="secondary">
            {finishedExports}/{queueSize}
          </Badge>
          {t("queue.labels.renderQueue")}
        </MotionExportActionButton>
      </DialogTrigger>
    </ExportActionTooltip>
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
      {t("queue.actions.start")}
    </Button>
  );
}

function ExportActionButton({
  children,
  className,
  icon,
  variant = "secondary",
  ...props
}: ComponentProps<typeof Button> & { icon?: React.ReactNode }) {
  return (
    <Button
      className={cn(
        "max-w-44 max-2xl:size-7 max-2xl:gap-0 max-2xl:rounded-[min(var(--radius-md),12px)] max-2xl:p-0",
        className,
      )}
      size="sm"
      type="button"
      variant={variant}
      {...props}
    >
      {icon}
      <span className="inline-flex items-center gap-1 truncate max-2xl:sr-only">{children}</span>
    </Button>
  );
}

const MotionExportActionButton = motion.create(ExportActionButton);

function ExportActionTooltip({
  children,
  disabled,
  tooltip,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  tooltip: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex" tabIndex={disabled ? 0 : undefined}>
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

export { ExportActions };

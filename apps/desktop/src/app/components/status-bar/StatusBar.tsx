import { CircleAlert, Download, LoaderCircle } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { SupportLink } from "@/app/components/SupportLink";
import type { UpdateStatus } from "@/app/contexts/app-updates-context";
import { useAppUpdates } from "@/app/hooks/useAppUpdates";
import { useAppSelector } from "@/app/store/redux-hooks";
import { type ExportQueueItem, selectExportQueue } from "@/app/store/slices/export-slice";
import { formatExportDuration, formatExportFileSize } from "@/domain/export-metrics";
import { getCurrentVersion } from "@/lib/app-version.utils";

function splitFilePath(path: string) {
  const separatorIndex = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  if (separatorIndex < 0) return { directory: "", filename: path };

  return {
    directory: path.slice(0, separatorIndex + 1),
    filename: path.slice(separatorIndex + 1),
  };
}

function selectStatusBarExport(queue: ExportQueueItem[]) {
  return [...queue].reverse().find((item) => item.status === "rendering");
}

export function StatusBar() {
  const { t } = useTranslation();
  const queue = useAppSelector(selectExportQueue);
  const activeExport = selectStatusBarExport(queue);
  const activeExportPath = activeExport ? splitFilePath(activeExport.path) : null;
  const progressPercent = activeExport ? Math.round(activeExport.progressPercent ?? 0) : 0;

  return (
    <div className="bg-card/30">
      <footer
        className="flex h-7 min-h-7 shrink-0 items-center px-4 pb-1 text-xs text-muted-foreground"
        data-slot="status-bar"
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <span>v{getCurrentVersion()}</span>
          <span className="text-primary">·</span>
          <StatusBarUpdateButton />
        </span>
        {activeExport ? (
          <div className="ml-auto flex min-w-0 items-center gap-3 pl-4 text-muted-foreground">
            <span className="max-w-md truncate text-xs">
              <span>{activeExportPath?.directory}</span>
              <span className="font-medium text-foreground">
                {activeExportPath?.filename ?? activeExport.filename}
              </span>
            </span>
            <Separator className="mt-1 h-4 self-center" orientation="vertical" />
            <div className="flex shrink-0 items-center gap-2">
              <Progress
                aria-label={t("queue.accessibility.progress")}
                aria-valuemax={100}
                aria-valuemin={0}
                aria-valuenow={progressPercent}
                className="h-1.5 w-28"
                value={progressPercent}
              />
              <span className="w-10 text-right tabular-nums">{progressPercent}%</span>
            </div>
            <Separator className="mt-1 h-4 self-center" orientation="vertical" />
            <StatusMetricTooltip label={t("export.labels.frames")}>
              {activeExport.currentFrame ?? 0}f / {activeExport.totalFrames ?? 0}f
            </StatusMetricTooltip>
            <Separator className="mt-1 h-4 self-center" orientation="vertical" />
            <StatusMetricTooltip label={t("export.labels.fps")}>
              {Math.round(activeExport.fps ?? 0)} FPS
            </StatusMetricTooltip>
            <Separator className="mt-1 h-4 self-center" orientation="vertical" />
            <StatusMetricTooltip label={t("export.labels.bitrate")}>
              {activeExport.bitrate ?? "0 kbits/s"}
            </StatusMetricTooltip>
            <Separator className="mt-1 h-4 self-center" orientation="vertical" />
            <StatusMetricTooltip label={t("export.labels.estimateSize")}>
              {formatStatusFileSize(activeExport.fileSizeBytes)} /{" "}
              {formatStatusFileSize(activeExport.estimatedFileSizeBytes)}
            </StatusMetricTooltip>
            <Separator className="mt-1 h-4 self-center" orientation="vertical" />
            <StatusMetricTooltip label={t("export.labels.estimateTime")}>
              {formatExportDuration(activeExport.estimatedElapsedTimeMs ?? 0)} /{" "}
              {formatExportDuration(activeExport.estimatedTotalTimeMs ?? 0)}
            </StatusMetricTooltip>
          </div>
        ) : null}
      </footer>
    </div>
  );
}

function StatusMetricTooltip({ children, label }: { children: ReactNode; label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="shrink-0 py-1 tabular-nums">{children}</span>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}

function formatStatusFileSize(bytes: number | undefined) {
  return bytes === undefined || bytes === 0 ? "0 MB" : formatExportFileSize(bytes);
}

function StatusBarUpdateButton() {
  const { t } = useTranslation();
  const {
    availableVersion,
    checkForUpdates,
    installUpdate,
    isInstalling,
    status: updateStatus,
  } = useAppUpdates();

  const updateAction = getUpdateButtonAction(updateStatus, availableVersion, isInstalling, {
    loading: t("common.status.loading"),
    update: t("app.actions.update"),
    error: t("common.status.error"),
  });

  if (!updateAction) return <SupportLink />;

  const handleUpdateClick = () => {
    if (updateStatus === "available") {
      void installUpdate();
      return;
    }

    void checkForUpdates();
  };

  return (
    <Button
      disabled={updateAction.disabled}
      onClick={handleUpdateClick}
      size="xs"
      type="button"
      variant={updateAction.variant}
    >
      {updateAction.icon}
      {updateAction.label}
    </Button>
  );
}

interface StatusBarUpdateAction {
  disabled: boolean;
  icon: ReactNode;
  label: string;
  variant: "default" | "destructive";
}

interface StatusBarUpdateLabels {
  error: string;
  loading: string;
  update: string;
}

function getUpdateButtonAction(
  status: UpdateStatus,
  availableVersion: string | null,
  isLoading: boolean,
  labels: StatusBarUpdateLabels,
): StatusBarUpdateAction | null {
  if (isLoading || status === "checking") {
    return {
      label: labels.loading,
      icon: <LoaderCircle aria-hidden="true" className="size-3 animate-spin" />,
      disabled: true,
      variant: "default",
    };
  }

  if (status === "available" && availableVersion !== null) {
    return {
      label: labels.update,
      icon: <Download aria-hidden="true" className="size-3" />,
      disabled: false,
      variant: "default",
    };
  }

  if (status === "error") {
    return {
      label: labels.error,
      icon: <CircleAlert aria-hidden="true" className="size-3" />,
      disabled: false,
      variant: "destructive",
    };
  }

  return null;
}

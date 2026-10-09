import { CircleAlert, Download } from "lucide-react";
import { Fragment, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { SupportLink } from "@/app/components/SupportLink";
import type { UpdateStatus } from "@/app/contexts/app-updates-context";
import { useAppUpdates } from "@/app/hooks/useAppUpdates";
import { useAppSelector } from "@/app/store/redux-hooks";
import { selectRenderingAttempt } from "@/app/store/slices/editing-instances-slice";
import {
  formatExportDuration,
  formatExportFileSize,
  getExportMetricValues,
} from "@/domain/export-metrics";
import { getCurrentVersion } from "@/lib/app-version.utils";
import { cn } from "@/lib/class-names.utils";
import { requestWindowShutdown } from "@/lib/tauri/window";

function splitFilePath(path: string) {
  const separatorIndex = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  if (separatorIndex < 0) return { directory: "", filename: path };

  return {
    directory: path.slice(0, separatorIndex + 1),
    filename: path.slice(separatorIndex + 1),
  };
}

interface StatusBarProps {
  className?: string;
}

function StatusBar({ className }: StatusBarProps) {
  const { t } = useTranslation();

  const activeExport = useAppSelector(selectRenderingAttempt);

  const activeExportPath = activeExport
    ? splitFilePath(activeExport.attempt.output.displayPath)
    : null;

  const exportMetrics = activeExport ? getExportMetricValues(activeExport.attempt) : null;
  const statusMetrics: { id: string; label: string; value: string }[] = [];

  if (exportMetrics) {
    if (exportMetrics.currentFrame !== undefined && exportMetrics.totalFrames !== undefined) {
      statusMetrics.push({
        id: "frames",
        label: t("export.frameRate.framesLabel"),
        value: `${exportMetrics.currentFrame}f / ${exportMetrics.totalFrames}f`,
      });
    }
    if (exportMetrics.fps !== undefined) {
      statusMetrics.push({
        id: "fps",
        label: t("export.frameRate.fpsLabel"),
        value: `${Math.round(exportMetrics.fps)} FPS`,
      });
    }
    if (exportMetrics.bitrate !== undefined) {
      statusMetrics.push({
        id: "bitrate",
        label: t("export.bitrate.label"),
        value: exportMetrics.bitrate,
      });
    }
    if (
      exportMetrics.fileSizeBytes !== undefined ||
      exportMetrics.estimatedFileSizeBytes !== undefined
    ) {
      const fileSizeValues = [
        exportMetrics.fileSizeBytes,
        exportMetrics.estimatedFileSizeBytes,
      ].filter((value): value is number => value !== undefined);

      statusMetrics.push({
        id: "file-size",
        label: t("export.estimate.sizeLabel"),
        value: fileSizeValues.map(formatExportFileSize).join(" / "),
      });
    }
    if (
      exportMetrics.estimatedElapsedTimeMs !== undefined &&
      exportMetrics.estimatedTotalTimeMs !== undefined
    ) {
      statusMetrics.push({
        id: "time",
        label: t("export.estimate.timeLabel"),
        value: `${formatExportDuration(exportMetrics.estimatedElapsedTimeMs)} / ${formatExportDuration(exportMetrics.estimatedTotalTimeMs)}`,
      });
    }
  }

  return (
    <footer
      className={cn(
        "flex h-9 min-h-9 shrink-0 items-center text-xs text-muted-foreground",
        className,
      )}
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
              {activeExportPath?.filename ?? activeExport.attempt.output.displayName}
            </span>
          </span>
          <Separator className="mt-1 h-4 self-center" orientation="vertical" />
          <div className="flex shrink-0 items-center gap-2">
            <Progress
              aria-label={t("queue.progress.accessibleLabel")}
              aria-valuemax={100}
              aria-valuemin={0}
              className="h-1.5 w-28"
              indeterminate={exportMetrics?.indeterminate}
              value={exportMetrics?.progressPercent ?? 0}
            />
            {exportMetrics?.progressPercent !== null &&
            exportMetrics?.progressPercent !== undefined ? (
              <span className="w-10 text-right tabular-nums">
                {Math.round(exportMetrics.progressPercent)}%
              </span>
            ) : null}
          </div>
          {statusMetrics.map((metric) => (
            <Fragment key={metric.id}>
              <Separator className="mt-1 h-4 self-center" orientation="vertical" />
              <StatusMetricTooltip label={metric.label}>{metric.value}</StatusMetricTooltip>
            </Fragment>
          ))}
        </div>
      ) : null}
    </footer>
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
    update: t("updates.install"),
    error: t("common.status.error"),
  });

  if (!updateAction) return <SupportLink />;

  const handleUpdateClick = () => {
    if (updateStatus === "available") {
      void requestWindowShutdown(installUpdate);
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
      icon: <Spinner aria-hidden="true" className="size-3" />,
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

export { StatusBar };

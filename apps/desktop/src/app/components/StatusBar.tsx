import { CircleAlert, Download, LoaderCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useEffect, useState, type ReactNode } from "react";

import type { UpdateStatus } from "@/app/contexts/app-updates-context";
import { useAppUpdates } from "@/app/hooks/useAppUpdates";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import packageJson from "../../../../../package.json";
import { formatExportDuration, formatExportFileSize, type ExportToast } from "@/features/export";
import { selectStatusBarExport } from "./status-bar-utils";

export function StatusBar({ queue }: { queue: ExportToast[] }) {
  const { t } = useTranslation();
  const selectedExport = selectStatusBarExport(queue);
  const [rememberedExport, setRememberedExport] = useState<ExportToast | null>(
    selectedExport ?? null,
  );
  useEffect(() => {
    if (!selectedExport) return;
    // Keep the latest eligible export available if the queue has a transient gap.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRememberedExport(selectedExport);
  }, [selectedExport]);
  const activeExport = selectedExport ?? rememberedExport;
  const activeExportPath = activeExport ? splitFilePath(activeExport.path) : null;
  const progressPercent = activeExport
    ? activeExport.status === "completed"
      ? 100
      : Math.round(activeExport.progressPercent ?? 0)
    : 0;
  const progressFillClass =
    activeExport?.status === "completed"
      ? "bg-emerald-400"
      : activeExport?.status === "failed" || activeExport?.status === "canceled"
        ? "bg-destructive"
        : "bg-primary";

  return (
    <div className="bg-card/30">
      <footer
        data-slot="status-bar"
        className="flex h-7 min-h-7 shrink-0 items-center px-4 pb-1 text-xs text-muted-foreground"
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <span>v{packageJson.version}</span>
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
            <Separator orientation="vertical" className="h-4 mt-1 self-center" />
            <div className="flex shrink-0 items-center gap-2">
              <div
                className="h-1.5 w-28 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-label={t("statusBar.exportProgress")}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progressPercent}
              >
                <div
                  className={`h-full rounded-full transition-[width] duration-150 ${progressFillClass}`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className="w-10 text-right tabular-nums">{progressPercent}%</span>
            </div>
            <Separator orientation="vertical" className="h-4 mt-1 self-center" />
            <StatusMetricTooltip label={t("statusBar.frames")}>
              {activeExport.currentFrame ?? 0}f / {activeExport.totalFrames ?? 0}f
            </StatusMetricTooltip>
            <Separator orientation="vertical" className="h-4 mt-1 self-center" />
            <StatusMetricTooltip label={t("statusBar.fps")}>
              {Math.round(activeExport.fps ?? 0)} FPS
            </StatusMetricTooltip>
            <Separator orientation="vertical" className="h-4 mt-1 self-center" />
            <StatusMetricTooltip label={t("statusBar.bitrate")}>
              {activeExport.bitrate ?? "0 kbits/s"}
            </StatusMetricTooltip>
            <Separator orientation="vertical" className="h-4 mt-1 self-center" />
            <StatusMetricTooltip label={t("statusBar.estimateSize")}>
              {formatStatusFileSize(activeExport.fileSizeBytes)} /{" "}
              {formatStatusFileSize(activeExport.estimatedFileSizeBytes)}
            </StatusMetricTooltip>
            <Separator orientation="vertical" className="h-4 mt-1 self-center" />
            <StatusMetricTooltip label={t("statusBar.estimateTime")}>
              {formatExportDuration(activeExport.estimatedElapsedTimeMs ?? 0)} /{" "}
              {formatExportDuration(activeExport.estimatedTotalTimeMs ?? 0)}
            </StatusMetricTooltip>
          </div>
        ) : null}
      </footer>
    </div>
  );
}

function StatusMetricTooltip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="shrink-0 tabular-nums py-1">{children}</span>
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
    status: updateStatus,
    availableVersion,
    isInstalling,
    checkForUpdates,
    installUpdate,
  } = useAppUpdates();
  const updateAction = getUpdateButtonAction(updateStatus, availableVersion, isInstalling, {
    loading: t("statusBar.loading"),
    update: t("statusBar.update"),
    error: t("statusBar.error"),
  });

  if (!updateAction) return null;

  const handleUpdateClick = () => {
    if (updateStatus === "available") {
      void installUpdate();
      return;
    }

    void checkForUpdates();
  };

  return (
    <Button
      type="button"
      size="xs"
      variant={updateAction.variant}
      disabled={updateAction.disabled}
      onClick={handleUpdateClick}
    >
      {updateAction.icon}
      {updateAction.label}
    </Button>
  );
}

interface StatusBarUpdateAction {
  label: string;
  icon: ReactNode;
  disabled: boolean;
  variant: "default" | "destructive";
}

interface StatusBarUpdateLabels {
  loading: string;
  update: string;
  error: string;
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
      icon: <LoaderCircle className="size-3 animate-spin" aria-hidden="true" />,
      disabled: true,
      variant: "default",
    };
  }

  if (status === "available" && availableVersion !== null) {
    return {
      label: labels.update,
      icon: <Download className="size-3" aria-hidden="true" />,
      disabled: false,
      variant: "default",
    };
  }

  if (status === "error") {
    return {
      label: labels.error,
      icon: <CircleAlert className="size-3" aria-hidden="true" />,
      disabled: false,
      variant: "destructive",
    };
  }

  return null;
}

function splitFilePath(path: string) {
  const separatorIndex = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  if (separatorIndex < 0) return { directory: "", filename: path };

  return {
    directory: path.slice(0, separatorIndex + 1),
    filename: path.slice(separatorIndex + 1),
  };
}

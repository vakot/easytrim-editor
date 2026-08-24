import { CircleAlert, Download, LoaderCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useAppUpdates } from "@/app/update-context";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import packageJson from "../../../../../package.json";
import type { ExportToast } from "@/features/export";

export function StatusBar({ queue }: { queue: ExportToast[] }) {
  const { t } = useTranslation();
  const {
    status: updateStatus,
    availableVersion,
    isInstalling,
    checkForUpdates,
    installUpdate,
  } = useAppUpdates();
  const updateAction =
    isInstalling || updateStatus === "checking"
      ? {
          label: t("statusBar.loading"),
          icon: <LoaderCircle className="size-3 animate-spin" aria-hidden="true" />,
          disabled: true,
        }
      : updateStatus === "available" && availableVersion !== null
        ? {
            label: t("statusBar.update"),
            icon: <Download className="size-3" aria-hidden="true" />,
            disabled: false,
          }
        : updateStatus === "error"
          ? {
              label: t("statusBar.error"),
              icon: <CircleAlert className="size-3" aria-hidden="true" />,
              disabled: false,
            }
          : null;
  const activeExport = queue.find((item) => item.status === "rendering");
  const activeExportPath = activeExport ? splitFilePath(activeExport.path) : null;
  const activeExportFps = activeExport?.estimatedFps;

  return (
    <div className="bg-card/30">
      <Separator />
      <footer
        data-slot="status-bar"
        className="flex h-8 min-h-8 shrink-0 items-center px-4 py-1 text-xs text-muted-foreground"
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <span>v{packageJson.version}</span>
          {updateAction ? (
            <Button
              type="button"
              size="xs"
              disabled={updateAction.disabled}
              onClick={() =>
                void (updateStatus === "available" ? installUpdate() : checkForUpdates())
              }
            >
              {updateAction.icon}
              {updateAction.label}
            </Button>
          ) : null}
        </span>
        {activeExport ? (
          <div className="ml-auto flex min-w-0 items-center gap-3 pl-4 text-muted-foreground">
            <span className="max-w-[28rem] truncate text-xs" title={activeExport.path}>
              <span>{activeExportPath?.directory}</span>
              <span className="font-medium text-foreground">
                {activeExportPath?.filename ?? activeExport.filename}
              </span>
            </span>
            <Separator orientation="vertical" className="h-4 self-center" />
            <div className="flex shrink-0 items-center gap-2">
              <div
                className="h-1.5 w-28 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-label={t("statusBar.exportProgress")}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(activeExport.progressPercent ?? 0)}
              >
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-150"
                  style={{ width: `${activeExport.progressPercent ?? 0}%` }}
                />
              </div>
              <span className="w-10 text-right tabular-nums">
                {Math.round(activeExport.progressPercent ?? 0)}%
              </span>
            </div>
            {activeExport.totalFrames !== undefined && activeExport.currentFrame !== undefined ? (
              <>
                <Separator orientation="vertical" className="h-4 self-center" />
                <span className="shrink-0 tabular-nums">
                  {activeExport.currentFrame}f / {activeExport.totalFrames}f
                </span>
              </>
            ) : null}
            {activeExportFps !== undefined ? (
              <>
                <Separator orientation="vertical" className="h-4 self-center" />
                <span className="shrink-0 tabular-nums">{Math.round(activeExportFps)} FPS</span>
              </>
            ) : null}
            {activeExport.bitrate ? (
              <>
                <Separator orientation="vertical" className="h-4 self-center" />
                <span className="shrink-0 tabular-nums">{activeExport.bitrate}</span>
              </>
            ) : null}
            {activeExport.fileSizeBytes !== undefined ? (
              <>
                <Separator orientation="vertical" className="h-4 self-center" />
                <span className="shrink-0 tabular-nums">
                  {formatFileSize(activeExport.fileSizeBytes)}
                </span>
              </>
            ) : null}
          </div>
        ) : null}
      </footer>
    </div>
  );
}

function splitFilePath(path: string) {
  const separatorIndex = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  if (separatorIndex < 0) return { directory: "", filename: path };

  return {
    directory: path.slice(0, separatorIndex + 1),
    filename: path.slice(separatorIndex + 1),
  };
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = -1;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

import { ExternalLink } from "lucide-react";
import { useTranslation } from "react-i18next";

import packageJson from "../../../../../package.json";
import { openExternalUrl } from "@/lib/open-external-url";
import type { AvailableUpdate } from "@/features/release/release-check";
import type { ExportToast } from "@/features/export";

export function StatusBar({
  update,
  queue,
}: {
  update: AvailableUpdate | null;
  queue: ExportToast[];
}) {
  const { t } = useTranslation();
  const appSha = import.meta.env.VITE_APP_SHA?.trim();
  const activeExport = queue.find((item) => item.status === "rendering");
  const activeExportPath = activeExport ? splitFilePath(activeExport.path) : null;
  const activeExportFps = activeExport?.estimatedFps;

  return (
    <footer
      data-slot="status-bar"
      className="flex h-8 min-h-8 shrink-0 items-center border-t border-border bg-card/30 px-4 py-1 text-xs text-muted-foreground"
    >
      <span className="flex min-w-0 items-center gap-1.5">
        <span>v{packageJson.version}</span>
        {update ? (
          <>
            <span aria-hidden="true">·</span>
            <a
              href={update.url}
              className="inline-flex items-center gap-0.5 text-primary underline-offset-2 hover:underline"
              onClick={(event) => {
                event.preventDefault();
                void openExternalUrl(update.url);
              }}
            >
              <span>{t("release.updateAvailableShort")}</span>
              <ExternalLink className="size-3" aria-hidden="true" />
            </a>
          </>
        ) : null}
        {appSha ? (
          <>
            <span aria-hidden="true">·</span>
            <code>{appSha.slice(0, 7)}</code>
          </>
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
          <span className="h-4 w-px shrink-0 bg-border" aria-hidden="true" />
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
          {activeExportFps !== undefined ? (
            <>
              <span className="h-4 w-px shrink-0 bg-border" aria-hidden="true" />
              <span className="shrink-0 tabular-nums">{Math.round(activeExportFps)} FPS</span>
            </>
          ) : null}
        </div>
      ) : null}
    </footer>
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

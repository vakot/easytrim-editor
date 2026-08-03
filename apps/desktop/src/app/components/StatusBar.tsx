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
          <span
            className="max-w-[24rem] truncate font-medium text-foreground"
            title={activeExport.filename}
          >
            {activeExport.filename}
          </span>
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
          {activeExport.estimatedFps !== undefined ? (
            <span className="shrink-0 tabular-nums">
              {Math.round(activeExport.estimatedFps)} FPS
            </span>
          ) : null}
          <span className="max-w-[28rem] truncate text-xs" title={activeExport.path}>
            {activeExport.path}
          </span>
        </div>
      ) : null}
    </footer>
  );
}

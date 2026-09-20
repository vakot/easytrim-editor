import { useTranslation } from "react-i18next";

import type { ExportAttempt } from "@/domain/editing-instance";
import { formatExportDuration } from "@/domain/export-metrics";
import { formatBytes, formatSourcePath } from "@/features/source";

import type { ActivityEntry } from "../../../lib/activity-projection";

interface ActivityToastDescriptionProps {
  attempt: ExportAttempt | undefined;
  entry: ActivityEntry;
}

function ActivityToastDescription({ attempt, entry }: ActivityToastDescriptionProps) {
  const { t } = useTranslation();
  const paths = stringArrayValue(entry.data?.sourcePaths);
  const outputPath =
    stringValue(entry.data?.outputPath) ??
    (attempt?.state.status === "completed" ? attempt.state.result.displayPath : entry.path);

  const sourcePath = stringValue(entry.data?.sourcePath) ?? attempt?.request.sourcePath;
  const visiblePaths = paths.slice(0, 2);
  const remainingPathCount = paths.length - visiblePaths.length;
  const fileSize = numberValue(entry.data?.fileSizeBytes) ?? attempt?.metrics.fileSizeBytes;
  const renderTime = numberValue(entry.data?.durationMs) ?? attempt?.metrics.durationMs;
  const metrics = [
    fileSize !== undefined
      ? t("app.messages.notifications.fileSize", { size: formatBytes(fileSize, "") })
      : null,
    renderTime !== null && renderTime !== undefined
      ? t("app.messages.notifications.renderTime", { duration: formatExportDuration(renderTime) })
      : null,
  ].filter((metric): metric is string => metric !== null);

  return (
    <div className="grid min-w-0 gap-0.5">
      {sourcePath ? (
        <span className="truncate" title={sourcePath}>
          {t("app.messages.notifications.sourcePath", { path: formatSourcePath(sourcePath) })}
        </span>
      ) : null}
      {outputPath ? (
        <span className="truncate" title={outputPath}>
          {t("app.messages.notifications.outputPath", { path: formatSourcePath(outputPath) })}
        </span>
      ) : null}
      {paths.length > 0 ? (
        <div className="grid gap-0.5">
          {visiblePaths.map((path) => (
            <span className="truncate" key={path} title={path}>
              {formatSourcePath(path)}
            </span>
          ))}
          {remainingPathCount > 0 ? (
            <span>{t("app.messages.notifications.moreFiles", { count: remainingPathCount })}</span>
          ) : null}
        </div>
      ) : null}
      {metrics.length > 0 ? <span>{metrics.join(" · ")}</span> : null}
    </div>
  );
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function stringArrayValue(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export { ActivityToastDescription };

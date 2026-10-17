import { formatExportDuration, formatExportFileSize } from "@/domain/export-metrics";

import type { AchievementMetricUnit } from "../../../lib/achievements.utils";

/** Formats a progress value in the unit of its metric, matching the Statistics dialog. */
function formatAchievementValue(
  value: number,
  unit: AchievementMetricUnit,
  locale: string,
): string {
  switch (unit) {
    case "bytes":
      return formatExportFileSize(value);
    case "count":
      return new Intl.NumberFormat(locale).format(value);
    case "duration":
      return formatExportDuration(value);
  }
}

export { formatAchievementValue };

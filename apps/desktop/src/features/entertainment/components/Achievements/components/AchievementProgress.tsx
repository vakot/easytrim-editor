import { useTranslation } from "react-i18next";

import { Progress } from "@easytrim-editor/ui/progress";

import type { AchievementMetricUnit } from "../../../lib/achievements.utils";
import { formatAchievementValue } from "../lib/achievements-format.utils";

/** A progress bar with its current and target values in the metric's unit. The bar stops at full. */
function AchievementProgress({
  label,
  progress,
  title,
  unit,
}: {
  label?: string;
  progress: { current: number; target: number };
  title: string;
  unit: AchievementMetricUnit;
}) {
  const { i18n, t } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const current = formatAchievementValue(progress.current, unit, locale);
  const target = formatAchievementValue(progress.target, unit, locale);

  return (
    <div className="flex flex-col gap-1 pt-1">
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        {label ? <span>{label}</span> : null}
        <span aria-hidden="true" className="ml-auto shrink-0 tabular-nums">
          {current} / {target}
        </span>
      </div>
      <Progress
        aria-label={t("achievements.itemProgress.label", { title })}
        aria-valuetext={t("achievements.itemProgress.value", { current, target })}
        value={Math.min(100, (progress.current / progress.target) * 100)}
      />
    </div>
  );
}

export { AchievementProgress };

import { useTranslation } from "react-i18next";

import { Progress } from "@/components/ui/progress";

import { achievementMetricUnits } from "../../../lib/achievements.utils";
import type { AchievementMetric } from "../../../types/achievements.types";
import { formatAchievementValue } from "../lib/achievements-format.utils";

/** A progress bar with its current and target values in the metric's unit. */
function AchievementProgress({
  label,
  metric,
  progress,
  title,
}: {
  label?: string;
  metric: AchievementMetric;
  progress: { current: number; target: number };
  title: string;
}) {
  const { i18n, t } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const unit = achievementMetricUnits[metric];
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
        value={(progress.current / progress.target) * 100}
      />
    </div>
  );
}

export { AchievementProgress };

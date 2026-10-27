import { CircleCheckBig, Lock, Medal } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Badge } from "@easytrim-editor/ui/badge";
import { cn } from "@easytrim-editor/ui/class-names";
import { formatDateOnly } from "@easytrim-editor/ui/date-time";
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@easytrim-editor/ui/item";

import { useAppSelector } from "@/app/store/redux-hooks";
import { selectAchievementRecords } from "@/app/store/slices/achievements-slice";
import { selectUsageStatistics } from "@/app/store/slices/usage-statistics-slice";

import { achievementTierClassNames } from "../../../consts/achievement-tier-styles.consts";
import {
  achievementMetricUnits,
  type AchievementTierStatus,
  getAchievementTierLabel,
  getSeriesProgress,
  isAchievementNew,
  isEntryNew,
} from "../../../lib/achievements.utils";
import type { AchievementSeriesDefinition } from "../../../types/achievements.types";
import { useAchievementsViewedAt } from "../contexts/AchievementsViewContext";
import { formatAchievementValue } from "../lib/achievements-format.utils";

import { AchievementNewPing } from "./AchievementNewPing";
import { AchievementProgress } from "./AchievementProgress";

/** One card for a milestone series: its highest tier, progress to the next, and every tier. */
function AchievementSeriesItem({ series }: { series: AchievementSeriesDefinition }) {
  const { i18n, t } = useTranslation();
  const records = useAppSelector(selectAchievementRecords);
  const statistics = useAppSelector(selectUsageStatistics);
  const viewedAt = useAchievementsViewedAt();

  const locale = i18n.resolvedLanguage ?? i18n.language;
  const { current, next, progress, tiers } = getSeriesProgress(series, { records, statistics });
  const completed = next === null;
  const isNew = isEntryNew(series, records, viewedAt);
  const title = series.title(t);
  const Icon = series.icon;
  const unknownDate = t("achievements.unknownDate");

  return (
    <Item
      className={cn(
        "items-start",
        current ? achievementTierClassNames[current.tier].card : "bg-muted/40",
      )}
      data-state={completed ? "completed" : current ? "unlocked" : "locked"}
      data-tier={current?.tier}
      role="listitem"
      size="sm"
      variant="outline"
    >
      <ItemMedia
        aria-hidden="true"
        className={cn(
          "relative size-11 rounded-lg [&_svg:not([class*='size-'])]:size-5",
          current
            ? cn("ring-1", achievementTierClassNames[current.tier].medallion)
            : "bg-muted text-muted-foreground",
        )}
        variant="icon"
      >
        <Icon />
        {isNew ? <AchievementNewPing /> : null}
      </ItemMedia>
      <ItemContent className="min-w-0 gap-1">
        <div className="flex items-start justify-between gap-2">
          <ItemTitle className={cn("min-w-0 wrap-break-word", !current && "text-muted-foreground")}>
            {title}
          </ItemTitle>
          {isNew ? <span className="sr-only">{t("achievements.new")}</span> : null}
          {current ? (
            <Badge
              className={achievementTierClassNames[current.tier].badge}
              size="xs"
              variant="outline"
            >
              {completed ? <CircleCheckBig aria-hidden="true" /> : null}
              {completed
                ? t("achievements.series.completed")
                : getAchievementTierLabel(current.tier, t)}
            </Badge>
          ) : (
            <Badge size="xs" variant="outline">
              <Lock aria-hidden="true" />
              {t("achievements.status.locked")}
            </Badge>
          )}
        </div>
        <ItemDescription className="text-xs">{series.description(t)}</ItemDescription>

        {progress ? (
          <AchievementProgress
            label={
              next
                ? t("achievements.series.nextTier", { tier: getAchievementTierLabel(next.tier, t) })
                : t("achievements.series.total")
            }
            progress={progress}
            title={title}
            unit={achievementMetricUnits[series.metric]}
          />
        ) : null}

        <ul aria-label={t("achievements.series.tiersLabel")} className="flex flex-wrap gap-1 pt-1">
          {tiers.map((tier) => (
            <AchievementTierIndicator
              isNew={isAchievementNew(tier.id, records, viewedAt)}
              key={tier.tier}
              label={tierIndicatorLabel(tier)}
              tier={tier}
              value={formatAchievementValue(
                tier.target,
                achievementMetricUnits[series.metric],
                locale,
              )}
            />
          ))}
        </ul>

        {current?.unlockedAt != null ? (
          <p className="text-xs text-muted-foreground">
            {t("achievements.series.tierUnlockedOn", {
              date: formatDateOnly(current.unlockedAt, locale, unknownDate),
              tier: getAchievementTierLabel(current.tier, t),
            })}
          </p>
        ) : null}
      </ItemContent>
    </Item>
  );

  function tierIndicatorLabel(tier: AchievementTierStatus): string {
    const tierLabel = getAchievementTierLabel(tier.tier, t);
    const target = formatAchievementValue(
      tier.target,
      achievementMetricUnits[series.metric],
      locale,
    );

    if (tier.unlockedAt === null) {
      return t("achievements.series.tierLocked", { target, tier: tierLabel });
    }
    const unlocked = t("achievements.series.tierUnlocked", {
      date: formatDateOnly(tier.unlockedAt, locale, unknownDate),
      target,
      tier: tierLabel,
    });

    return isAchievementNew(tier.id, records, viewedAt)
      ? t("achievements.series.tierUnlockedNew", { tier: unlocked })
      : unlocked;
  }
}

/** A tier chip: the medal in its tier color and the threshold that unlocks it. */
function AchievementTierIndicator({
  isNew,
  label,
  tier,
  value,
}: {
  isNew: boolean;
  label: string;
  tier: AchievementTierStatus;
  value: string;
}) {
  const unlocked = tier.unlockedAt !== null;

  return (
    <li
      aria-label={label}
      className={cn(
        "relative inline-flex h-5 items-center gap-1 rounded-4xl border px-1.5 text-[0.625rem] font-medium tabular-nums",
        unlocked
          ? achievementTierClassNames[tier.tier].chip
          : achievementTierClassNames[tier.tier].chipLocked,
      )}
      data-state={unlocked ? "unlocked" : "locked"}
      data-tier={tier.tier}
    >
      <Medal aria-hidden="true" className="size-3" />
      <span aria-hidden="true">{value}</span>
      {isNew ? <AchievementNewPing className="top-0 right-0.5 size-1.5 before:size-1.5" /> : null}
    </li>
  );
}

export { AchievementSeriesItem };

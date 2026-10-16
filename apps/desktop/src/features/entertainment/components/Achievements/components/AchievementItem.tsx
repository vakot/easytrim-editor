import { Check, Lock, LockKeyhole } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item";
import { Progress } from "@/components/ui/progress";

import { useAppSelector } from "@/app/store/redux-hooks";
import { selectAchievementRecords } from "@/app/store/slices/achievements-slice";
import { selectUsageStatistics } from "@/app/store/slices/usage-statistics-slice";
import { cn } from "@/lib/class-names.utils";
import { formatDateOnly } from "@/lib/date-time.utils";

import {
  achievementMetricUnits,
  getAchievementDefinition,
  getAchievementProgress,
  getAchievementUnlockedAt,
} from "../../../lib/achievements.utils";
import { formatAchievementValue } from "../lib/achievements-format.utils";

function AchievementItem({ achievementId }: { achievementId: string }) {
  const { i18n, t } = useTranslation();
  const records = useAppSelector(selectAchievementRecords);
  const statistics = useAppSelector(selectUsageStatistics);
  const definition = getAchievementDefinition(achievementId);
  if (!definition) return null;

  const locale = i18n.resolvedLanguage ?? i18n.language;
  const unlockedAt = getAchievementUnlockedAt(definition, records);
  const unlocked = unlockedAt !== null;
  // A locked secret reveals nothing about itself, not even how close it is.
  const concealed = definition.secret === true && !unlocked;
  const progress =
    unlocked || concealed || definition.target <= 1
      ? null
      : getAchievementProgress(definition, { records, statistics });

  const Icon = concealed ? LockKeyhole : definition.icon;
  const title = concealed ? t("achievements.secret.title") : definition.title(t);
  const unit = achievementMetricUnits[definition.metric];

  return (
    <Item
      className={cn("items-start", !unlocked && "bg-muted/40")}
      data-state={unlocked ? "unlocked" : "locked"}
      role="listitem"
      size="sm"
      variant="outline"
    >
      <ItemMedia
        aria-hidden="true"
        className={cn(
          "rounded-md p-2",
          unlocked ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
        )}
        variant="icon"
      >
        <Icon />
      </ItemMedia>
      <ItemContent className="min-w-0 gap-1">
        <div className="flex items-start justify-between gap-2">
          <ItemTitle
            className={cn("min-w-0 wrap-break-word", !unlocked && "text-muted-foreground")}
          >
            {title}
          </ItemTitle>
          <Badge size="xs" variant={unlocked ? "success" : "outline"}>
            {unlocked ? <Check aria-hidden="true" /> : <Lock aria-hidden="true" />}
            {unlocked ? t("achievements.status.unlocked") : t("achievements.status.locked")}
          </Badge>
        </div>
        <ItemDescription className="text-xs">
          {concealed ? t("achievements.secret.description") : definition.description(t)}
        </ItemDescription>
        {unlocked ? (
          <p className="text-xs text-muted-foreground">
            {t("achievements.unlockedOn", {
              date: formatDateOnly(unlockedAt, locale, t("achievements.unknownDate")),
            })}
          </p>
        ) : null}
        {progress ? (
          <div className="flex items-center gap-2 pt-1">
            <Progress
              aria-label={t("achievements.itemProgress.label", { title })}
              aria-valuetext={t("achievements.itemProgress.value", {
                current: formatAchievementValue(progress.current, unit, locale),
                target: formatAchievementValue(progress.target, unit, locale),
              })}
              className="flex-1"
              value={(progress.current / progress.target) * 100}
            />
            <span
              aria-hidden="true"
              className="shrink-0 text-xs text-muted-foreground tabular-nums"
            >
              {formatAchievementValue(progress.current, unit, locale)} /{" "}
              {formatAchievementValue(progress.target, unit, locale)}
            </span>
          </div>
        ) : null}
      </ItemContent>
    </Item>
  );
}

export { AchievementItem };

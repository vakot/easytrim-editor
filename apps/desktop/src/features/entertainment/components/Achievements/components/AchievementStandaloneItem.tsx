import { Check, Lock, LockKeyhole } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item";

import { useAppSelector } from "@/app/store/redux-hooks";
import { selectAchievementRecords } from "@/app/store/slices/achievements-slice";
import { selectUsageStatistics } from "@/app/store/slices/usage-statistics-slice";
import { cn } from "@/lib/class-names.utils";
import { formatDateOnly } from "@/lib/date-time.utils";

import {
  getAchievementUnlockedAt,
  getStandaloneAchievementProgress,
  isAchievementNew,
} from "../../../lib/achievements.utils";
import type { StandaloneAchievementDefinition } from "../../../types/achievements.types";
import { useAchievementsViewedAt } from "../contexts/AchievementsViewContext";

import { AchievementNewPing } from "./AchievementNewPing";
import { AchievementProgress } from "./AchievementProgress";

function AchievementStandaloneItem({
  definition,
}: {
  definition: StandaloneAchievementDefinition;
}) {
  const { i18n, t } = useTranslation();
  const records = useAppSelector(selectAchievementRecords);
  const statistics = useAppSelector(selectUsageStatistics);
  const viewedAt = useAchievementsViewedAt();

  const locale = i18n.resolvedLanguage ?? i18n.language;
  const unlockedAt = getAchievementUnlockedAt(definition.id, records);
  const unlocked = unlockedAt !== null;
  const isNew = isAchievementNew(definition.id, records, viewedAt);
  // A locked secret reveals nothing about itself, not even how close it is.
  const concealed = definition.secret === true && !unlocked;
  const progress =
    unlocked || concealed || definition.target <= 1
      ? null
      : getStandaloneAchievementProgress(definition, { records, statistics });

  const Icon = concealed ? LockKeyhole : definition.icon;
  const title = concealed ? t("achievements.secret.title") : definition.title(t);

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
          "relative size-11 rounded-lg [&_svg:not([class*='size-'])]:size-5",
          unlocked ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
        )}
        variant="icon"
      >
        <Icon />
        {isNew ? <AchievementNewPing /> : null}
      </ItemMedia>
      <ItemContent className="min-w-0 gap-1">
        <div className="flex items-start justify-between gap-2">
          <ItemTitle
            className={cn("min-w-0 wrap-break-word", !unlocked && "text-muted-foreground")}
          >
            {title}
          </ItemTitle>
          {isNew ? <span className="sr-only">{t("achievements.new")}</span> : null}
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
          <AchievementProgress metric={definition.metric} progress={progress} title={title} />
        ) : null}
      </ItemContent>
    </Item>
  );
}

export { AchievementStandaloneItem };

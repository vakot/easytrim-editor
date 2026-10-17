import { Check, Lock, LockKeyhole } from "lucide-react";
import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item";

import { useAppSelector } from "@/app/store/redux-hooks";
import { selectAchievementRecords } from "@/app/store/slices/achievements-slice";
import { selectUsageStatistics } from "@/app/store/slices/usage-statistics-slice";
import { cn } from "@/lib/class-names.utils";
import { formatDateOnly } from "@/lib/date-time.utils";

import { useAchievementSecretGradientId } from "../../../hooks/useAchievementSecretGradientId";
import {
  getAchievementUnlockedAt,
  getStandaloneAchievementProgress,
  isAchievementNew,
} from "../../../lib/achievements.utils";
import type { StandaloneAchievementDefinition } from "../../../types/achievements.types";
import styles from "../../AchievementSecret.module.css";
import { AchievementSecretGradient } from "../../AchievementSecretGradient";
import { useAchievementsViewedAt } from "../contexts/AchievementsViewContext";

import { AchievementNewPing } from "./AchievementNewPing";
import { AchievementProgress } from "./AchievementProgress";

function AchievementStandaloneItem({
  compact = false,
  definition,
  presentation = "achievement",
}: {
  compact?: boolean;
  definition: StandaloneAchievementDefinition;
  presentation?: "achievement" | "onboarding";
}) {
  const { i18n, t } = useTranslation();
  const records = useAppSelector(selectAchievementRecords);
  const statistics = useAppSelector(selectUsageStatistics);
  const viewedAt = useAchievementsViewedAt();
  const gradientId = useAchievementSecretGradientId();

  const locale = i18n.resolvedLanguage ?? i18n.language;
  const unlockedAt = getAchievementUnlockedAt(definition.id, records);
  const unlocked = unlockedAt !== null;
  const onboarding = presentation === "onboarding";
  const isNew = !onboarding && isAchievementNew(definition.id, records, viewedAt);
  // A locked secret reveals nothing about itself, not even how close it is.
  const concealed = definition.secret === true && !unlocked;
  // A single-step achievement has no progress worth showing.
  const measured =
    unlocked || concealed
      ? null
      : getStandaloneAchievementProgress(definition, { records, statistics });

  const progress = measured && measured.target > 1 ? measured : null;
  const secret = definition.secret === true;

  const completedDate =
    unlocked && !onboarding
      ? formatDateOnly(unlockedAt, locale, t("achievements.unknownDate"))
      : "";

  const Icon = concealed ? LockKeyhole : definition.icon;
  const title = concealed ? t("achievements.secret.title") : definition.title(t);

  return (
    <Item
      className={cn(
        "items-start",
        compact && "p-2",
        onboarding ? "bg-card" : !unlocked && "bg-muted/40",
        secret && styles.card,
      )}
      data-secret={secret ? "true" : undefined}
      data-secret-state={secret ? (unlocked ? "unlocked" : "locked") : undefined}
      data-state={unlocked ? "unlocked" : "locked"}
      role="listitem"
      size={compact ? "xs" : "sm"}
      style={
        secret ? ({ "--secret-icon-stroke": `url(#${gradientId})` } as CSSProperties) : undefined
      }
      variant="outline"
    >
      {secret ? <AchievementSecretGradient id={gradientId} /> : null}
      <ItemMedia
        aria-hidden="true"
        className={cn(
          "relative rounded-lg",
          compact
            ? "size-8 group-has-data-[slot=item-description]/item:translate-y-0 [&_svg:not([class*='size-'])]:size-4"
            : "size-11 [&_svg:not([class*='size-'])]:size-5",
          unlocked ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
          secret && styles.medallion,
        )}
        variant="icon"
      >
        <Icon />
        {isNew ? <AchievementNewPing /> : null}
      </ItemMedia>
      <ItemContent className={cn("min-w-0", compact ? "gap-0.5" : "gap-1")}>
        <div className="flex items-start justify-between gap-2">
          <ItemTitle
            className={cn(
              "min-w-0 wrap-break-word",
              compact && "text-xs",
              !unlocked && "text-muted-foreground",
            )}
          >
            {title}
          </ItemTitle>
          {isNew ? <span className="sr-only">{t("achievements.new")}</span> : null}
          {unlocked || !onboarding ? (
            <Badge size="xs" variant={unlocked ? "success" : "outline"}>
              {unlocked ? <Check aria-hidden="true" /> : <Lock aria-hidden="true" />}
              {unlocked
                ? onboarding
                  ? t("achievements.status.completed")
                  : t("achievements.status.unlocked")
                : t("achievements.status.locked")}
            </Badge>
          ) : null}
        </div>
        <ItemDescription className="text-xs">
          {concealed ? t("achievements.secret.description") : definition.description(t)}
        </ItemDescription>
        {unlocked && !onboarding ? (
          <p className="text-xs text-muted-foreground">
            {t("achievements.unlockedOn", { date: completedDate })}
          </p>
        ) : null}
        {progress ? (
          <AchievementProgress progress={progress} title={title} unit={progress.unit} />
        ) : null}
      </ItemContent>
    </Item>
  );
}

export { AchievementStandaloneItem };

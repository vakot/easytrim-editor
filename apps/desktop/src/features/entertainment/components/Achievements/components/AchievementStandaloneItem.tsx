import { LockKeyhole } from "lucide-react";
import { useTranslation } from "react-i18next";

import { AchievementCard } from "@easytrim-editor/ui/achievement-card";
import { formatDateOnly } from "@easytrim-editor/ui/date-time";

import { useAppSelector } from "@/app/store/redux-hooks";
import { selectAchievementRecords } from "@/app/store/slices/achievements-slice";
import { selectUsageStatistics } from "@/app/store/slices/usage-statistics-slice";

import {
  getAchievementUnlockedAt,
  getStandaloneAchievementProgress,
  isAchievementNew,
} from "../../../lib/achievements.utils";
import type { StandaloneAchievementDefinition } from "../../../types/achievements.types";
import { useAchievementsViewedAt } from "../contexts/AchievementsViewContext";

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

  const completedDate =
    unlocked && !onboarding
      ? formatDateOnly(unlockedAt, locale, t("achievements.unknownDate"))
      : "";

  const title = concealed ? t("achievements.secret.title") : definition.title(t);
  const status = unlocked
    ? onboarding
      ? t("achievements.status.completed")
      : t("achievements.status.unlocked")
    : onboarding
      ? undefined
      : t("achievements.status.locked");

  return (
    <AchievementCard
      compact={compact}
      description={concealed ? t("achievements.secret.description") : definition.description(t)}
      icon={concealed ? LockKeyhole : definition.icon}
      newLabel={isNew ? t("achievements.new") : undefined}
      presentation={presentation}
      secret={definition.secret === true}
      status={status}
      title={title}
      unlocked={unlocked}
    >
      {unlocked && !onboarding ? (
        <p className="text-xs text-muted-foreground">
          {t("achievements.unlockedOn", { date: completedDate })}
        </p>
      ) : null}
      {progress ? (
        <AchievementProgress progress={progress} title={title} unit={progress.unit} />
      ) : null}
    </AchievementCard>
  );
}

export { AchievementStandaloneItem };

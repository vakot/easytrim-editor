import type { TFunction } from "i18next";
import { Info } from "lucide-react";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Item, ItemContent, ItemDescription, ItemMedia } from "@/components/ui/item";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  selectAchievementRecords,
  selectAchievementRecordsStatus,
} from "@/app/store/slices/achievements-slice";
import { loadAchievementRecords } from "@/app/store/thunks/achievement-thunks";
import { loadUsageStatistics } from "@/app/store/thunks/usage-statistics-thunks";
import type { AchievementRecords } from "@/domain/achievement-records";
import { cn } from "@/lib/class-names.utils";

import { achievementCategories, achievementDefinitions } from "../../consts/achievements.consts";
import { countUnlockedAchievements, getAchievementUnlockedAt } from "../../lib/achievements.utils";
import type { AchievementCategory } from "../../types/achievements.types";

import { AchievementItem } from "./components/AchievementItem";
import { AchievementsCategory } from "./components/AchievementsCategory";
import { AchievementsLoading } from "./components/AchievementsLoading";
import { AchievementsUnavailable } from "./components/AchievementsUnavailable";

type AchievementsFilter = "all" | "locked" | "unlocked";

const achievementsFilters = ["all", "unlocked", "locked"] as const satisfies AchievementsFilter[];

/** Refreshes the records and statistics whenever it mounts, so every opening shows current progress. */
function Achievements({ children }: { children?: React.ReactNode }) {
  const dispatch = useAppDispatch();

  useEffect(() => {
    void dispatch(loadAchievementRecords());
    void dispatch(loadUsageStatistics());
  }, [dispatch]);

  return children;
}

/** Unlocked count out of the whole collection, with an overall progress bar. */
function AchievementsSummary({ className }: { className?: string }) {
  const { i18n, t } = useTranslation();
  const records = useAppSelector(selectAchievementRecords);
  if (!records) return null;

  const locale = i18n.resolvedLanguage ?? i18n.language;
  const total = achievementDefinitions.length;
  const unlocked = countUnlockedAchievements(records);
  const summary = t("achievements.summary", {
    total: new Intl.NumberFormat(locale).format(total),
    unlocked: new Intl.NumberFormat(locale).format(unlocked),
  });

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <Progress
        aria-label={t("achievements.progressLabel")}
        aria-valuetext={summary}
        className="flex-1"
        value={(unlocked / total) * 100}
      />
      <span className="shrink-0 text-sm font-medium tabular-nums">{summary}</span>
    </div>
  );
}

/** The filterable achievement collection, grouped by category, in its own scroll area. */
function AchievementsCollection({ className }: { className?: string }) {
  const { t } = useTranslation();
  const records = useAppSelector(selectAchievementRecords);
  const status = useAppSelector(selectAchievementRecordsStatus);
  const [filter, setFilter] = useState<AchievementsFilter>("all");

  if (!records) {
    return status === "failed" ? <AchievementsUnavailable /> : <AchievementsLoading />;
  }

  return (
    <Tabs
      className={cn("min-h-0 gap-0", className)}
      onValueChange={(value) => setFilter(value as AchievementsFilter)}
      value={filter}
    >
      <TabsList aria-label={t("achievements.filters.label")} className="my-3">
        {achievementsFilters.map((value) => (
          <TabsTrigger key={value} value={value}>
            {achievementsFilterLabel(value, t)}
          </TabsTrigger>
        ))}
      </TabsList>

      {achievementsFilters.map((value) => (
        <TabsContent className="flex min-h-0 flex-col" key={value} value={value}>
          <ScrollArea className="-mx-2 min-h-0 flex-1 px-2">
            <AchievementsList filter={value} records={records} />
          </ScrollArea>
        </TabsContent>
      ))}
    </Tabs>
  );
}

function AchievementsList({
  filter,
  records,
}: {
  filter: AchievementsFilter;
  records: AchievementRecords;
}) {
  const { t } = useTranslation();
  const visible = achievementDefinitions.filter((definition) => {
    if (filter === "all") return true;
    const unlocked = getAchievementUnlockedAt(definition, records) !== null;
    return filter === "unlocked" ? unlocked : !unlocked;
  });

  if (visible.length === 0) {
    return (
      <Item className="mb-4" size="sm" variant="muted">
        <ItemMedia className="text-muted-foreground" variant="icon">
          <Info aria-hidden="true" />
        </ItemMedia>
        <ItemContent>
          <ItemDescription>
            {filter === "unlocked"
              ? t("achievements.empty.unlocked")
              : t("achievements.empty.locked")}
          </ItemDescription>
        </ItemContent>
      </Item>
    );
  }

  return (
    <div className="flex flex-col gap-5 pb-4">
      {achievementCategories.map((category) => {
        const achievements = visible.filter((definition) => definition.category === category);
        if (achievements.length === 0) return null;

        return (
          <AchievementsCategory key={category} title={achievementCategoryLabel(category, t)}>
            {achievements.map((definition) => (
              <AchievementItem achievementId={definition.id} key={definition.id} />
            ))}
          </AchievementsCategory>
        );
      })}
    </div>
  );
}

function achievementsFilterLabel(filter: AchievementsFilter, t: TFunction): string {
  switch (filter) {
    case "all":
      return t("achievements.filters.all");
    case "locked":
      return t("achievements.filters.locked");
    case "unlocked":
      return t("achievements.filters.unlocked");
  }
}

function achievementCategoryLabel(category: AchievementCategory, t: TFunction): string {
  switch (category) {
    case "export-milestones":
      return t("achievements.categories.exportMilestones");
    case "export-specialization":
      return t("achievements.categories.exportSpecialization");
    case "processing-milestones":
      return t("achievements.categories.processingMilestones");
    case "secret-discoveries":
      return t("achievements.categories.secretDiscoveries");
  }
}

export { Achievements, AchievementsCollection, AchievementsSummary };

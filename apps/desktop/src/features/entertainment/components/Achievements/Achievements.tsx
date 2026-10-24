import type { TFunction } from "i18next";
import { Info } from "lucide-react";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { cn } from "@easytrim-editor/ui/class-names";

import { Item, ItemContent, ItemDescription, ItemMedia } from "@/components/ui/item";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  selectAchievementRecords,
  selectAchievementRecordsStatus,
} from "@/app/store/slices/achievements-slice";
import {
  loadAchievementRecords,
  markAchievementsViewed,
} from "@/app/store/thunks/achievement-thunks";
import { loadUsageStatistics } from "@/app/store/thunks/usage-statistics-thunks";
import type { AchievementRecords } from "@/domain/achievement-records";

import { achievementCategories, achievementCollection } from "../../consts/achievements.consts";
import {
  countUnlockedAchievements,
  isEntryLocked,
  isEntryUnlocked,
  totalUnlockableAchievements,
} from "../../lib/achievements.utils";
import type { AchievementCategory } from "../../types/achievements.types";

import { AchievementsCategory } from "./components/AchievementsCategory";
import { AchievementSeriesItem } from "./components/AchievementSeriesItem";
import { AchievementsLoading } from "./components/AchievementsLoading";
import { AchievementStandaloneItem } from "./components/AchievementStandaloneItem";
import { AchievementsUnavailable } from "./components/AchievementsUnavailable";
import { AchievementsViewContext } from "./contexts/AchievementsViewContext";

type AchievementsFilter = "all" | "locked" | "unlocked";

const achievementsFilters = ["all", "unlocked", "locked"] as const satisfies AchievementsFilter[];

/**
 * A view of the collection. It refreshes the records and statistics when it mounts, so every
 * opening shows current progress, and marks the collection viewed when it unmounts. Achievements
 * unlocked since the previous view stay marked new for as long as this view is open.
 */
function Achievements({ children }: { children?: React.ReactNode }) {
  const dispatch = useAppDispatch();
  const records = useAppSelector(selectAchievementRecords);
  const [view, setView] = useState<{ viewedAtMillis: number | null } | null>(null);
  // Capture the mark the first time the records are available, before this view can move it.
  if (records && !view) setView({ viewedAtMillis: records.viewedAtMillis });

  useEffect(() => {
    void dispatch(loadAchievementRecords());
    void dispatch(loadUsageStatistics());
    return () => void dispatch(markAchievementsViewed());
  }, [dispatch]);

  return (
    <AchievementsViewContext.Provider value={view}>{children}</AchievementsViewContext.Provider>
  );
}

/** Unlocked count out of the whole collection, with an overall progress bar. */
function AchievementsSummary({ className }: { className?: string }) {
  const { i18n, t } = useTranslation();
  const records = useAppSelector(selectAchievementRecords);
  if (!records) return null;

  const locale = i18n.resolvedLanguage ?? i18n.language;
  const total = totalUnlockableAchievements;
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
          <ScrollArea className="-mx-2 **:data-[slot=scroll-area-viewport]:px-2">
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
  // A partly unlocked series appears under both filters: it has unlocked and locked tiers.
  const visible = achievementCollection.filter((entry) => {
    if (filter === "all") return true;
    return filter === "unlocked" ? isEntryUnlocked(entry, records) : isEntryLocked(entry, records);
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
      {achievementCategories.map((category) => (
        <AchievementsCategoryContent category={category} filter={filter} key={category} />
      ))}
    </div>
  );
}

/** A read-only category surface; mounting it does not mark the collection viewed. */
function AchievementsCategoryContent({
  category,
  compact = false,
  filter = "all",
  presentation = "achievement",
}: {
  category: AchievementCategory;
  compact?: boolean;
  filter?: AchievementsFilter;
  presentation?: "achievement" | "onboarding";
}) {
  const { t } = useTranslation();
  const records = useAppSelector(selectAchievementRecords);
  if (!records) return null;

  const entries = achievementCollection.filter(
    (entry) =>
      entry.category === category &&
      (filter === "all" ||
        (filter === "unlocked" ? isEntryUnlocked(entry, records) : isEntryLocked(entry, records))),
  );

  if (entries.length === 0) return null;

  return (
    <AchievementsCategory compact={compact} title={achievementCategoryLabel(category, t)}>
      {entries.map((entry) =>
        entry.kind === "series" ? (
          <AchievementSeriesItem key={entry.id} series={entry} />
        ) : (
          <AchievementStandaloneItem
            compact={compact}
            definition={entry}
            key={entry.id}
            presentation={presentation}
          />
        ),
      )}
    </AchievementsCategory>
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
    case "getting-started":
      return t("achievements.categories.gettingStarted");
    case "processing-milestones":
      return t("achievements.categories.processingMilestones");
    case "secret-discoveries":
      return t("achievements.categories.secretDiscoveries");
  }
}

export { Achievements, AchievementsCategoryContent, AchievementsCollection, AchievementsSummary };

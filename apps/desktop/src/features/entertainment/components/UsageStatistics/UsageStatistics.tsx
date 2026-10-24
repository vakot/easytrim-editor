import {
  AudioLines,
  CalendarClock,
  CalendarPlus,
  CircleCheckBig,
  Clapperboard,
  FileInput,
  FileOutput,
  ImagePlay,
  Info,
  Percent,
  PiggyBank,
  Scissors,
  Timer,
  TimerReset,
  Trophy,
} from "lucide-react";
import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { cn } from "@easytrim-editor/ui/class-names";
import { ScrollArea } from "@easytrim-editor/ui/scroll-area";

import { Item, ItemContent, ItemDescription, ItemMedia } from "@/components/ui/item";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import { selectAchievementRecords } from "@/app/store/slices/achievements-slice";
import {
  selectUsageStatistics,
  selectUsageStatisticsStatus,
} from "@/app/store/slices/usage-statistics-slice";
import { loadAchievementRecords } from "@/app/store/thunks/achievement-thunks";
import { loadUsageStatistics } from "@/app/store/thunks/usage-statistics-thunks";
import { getSizeChangePresentation } from "@/components/size-change.utils";
import {
  formatExportDuration,
  formatExportFileSize,
  formatFileSizeChangePercent,
  getFileSizeChangeRatio,
} from "@/domain/export-metrics";
import { getCompletedExports, getStorageSavedBytes } from "@/domain/usage-statistics";
import { formatRelativeTime } from "@/lib/date-time.utils";

import {
  countUnlockedAchievements,
  totalUnlockableAchievements,
} from "../../lib/achievements.utils";

import { UsageStatisticsItem } from "./components/UsageStatisticsItem";
import { UsageStatisticsLoading } from "./components/UsageStatisticsLoading";
import { UsageStatisticsSection } from "./components/UsageStatisticsSection";
import { UsageStatisticsUnavailable } from "./components/UsageStatisticsUnavailable";
import { formatStatisticCount, formatStatisticDate } from "./lib/usage-statistics-format.utils";

/** Refreshes the native statistics and achievement records on mount, so each opening is current. */
function UsageStatistics({ children }: { children?: React.ReactNode }) {
  const dispatch = useAppDispatch();

  useEffect(() => {
    void dispatch(loadUsageStatistics());
    void dispatch(loadAchievementRecords());
  }, [dispatch]);

  return children;
}

/** Scrollable container for the dashboard, or the loading/unavailable state before data exists. */
function UsageStatisticsContent({ className, ...props }: React.ComponentProps<typeof ScrollArea>) {
  const hasStatistics = useAppSelector((state) => selectUsageStatistics(state) !== null);
  const status = useAppSelector(selectUsageStatisticsStatus);

  if (!hasStatistics) {
    return status === "failed" ? <UsageStatisticsUnavailable /> : <UsageStatisticsLoading />;
  }

  return <ScrollArea className={cn("min-h-0 flex-1", className)} {...props} />;
}

/** Presents the recorded usage statistics; renders nothing until they have loaded. */
function UsageStatisticsDashboard() {
  const { i18n, t } = useTranslation();
  const statistics = useAppSelector(selectUsageStatistics);
  const achievementRecords = useAppSelector(selectAchievementRecords);
  const locale = i18n.resolvedLanguage ?? i18n.language;
  if (!statistics) return null;

  const completedExports = getCompletedExports(statistics);
  const storageSavedBytes = getStorageSavedBytes(statistics);
  const sizeChange = getSizeChangePresentation(-storageSavedBytes);
  const ratio = getFileSizeChangeRatio(statistics.sourceBytes, statistics.outputBytes);
  const percentage = formatFileSizeChangePercent(ratio, locale);
  const notYet = t("statistics.notYet");

  return (
    <div className="flex flex-col gap-5 py-4">
      {completedExports === 0 ? (
        <Item size="sm" variant="muted">
          <ItemMedia className="text-muted-foreground" variant="icon">
            <Info aria-hidden="true" />
          </ItemMedia>
          <ItemContent>
            <ItemDescription>{t("statistics.empty")}</ItemDescription>
          </ItemContent>
        </Item>
      ) : null}

      <UsageStatisticsSection title={t("statistics.sections.overview")}>
        <UsageStatisticsItem
          description={t("statistics.metrics.completedExports.description")}
          icon={<CircleCheckBig />}
          label={t("statistics.metrics.completedExports.label")}
          value={formatStatisticCount(completedExports, locale)}
        />
        <UsageStatisticsItem
          description={t("statistics.metrics.processingTime.description")}
          icon={<Timer />}
          label={t("statistics.metrics.processingTime.label")}
          value={formatExportDuration(statistics.processingMillis)}
        />
        {achievementRecords ? (
          <UsageStatisticsItem
            description={t("statistics.metrics.achievementsUnlocked.description")}
            icon={<Trophy />}
            label={t("statistics.metrics.achievementsUnlocked.label")}
            value={`${formatStatisticCount(countUnlockedAchievements(achievementRecords), locale)} / ${formatStatisticCount(totalUnlockableAchievements, locale)}`}
          />
        ) : null}
        <UsageStatisticsItem
          description={t("statistics.metrics.longestExport.description")}
          icon={<TimerReset />}
          label={t("statistics.metrics.longestExport.label")}
          value={formatExportDuration(statistics.longestExportMillis)}
        />
      </UsageStatisticsSection>

      <UsageStatisticsSection title={t("statistics.sections.breakdown")}>
        <UsageStatisticsItem
          description={t("statistics.metrics.optimizedExports.description")}
          icon={<Clapperboard />}
          label={t("statistics.metrics.optimizedExports.label")}
          value={formatStatisticCount(statistics.optimizedExports, locale)}
        />
        <UsageStatisticsItem
          description={t("statistics.metrics.losslessCuts.description")}
          icon={<Scissors />}
          label={t("statistics.metrics.losslessCuts.label")}
          value={formatStatisticCount(statistics.losslessExports, locale)}
        />
        <UsageStatisticsItem
          description={t("statistics.metrics.gifExports.description")}
          icon={<ImagePlay />}
          label={t("statistics.metrics.gifExports.label")}
          value={formatStatisticCount(statistics.gifExports, locale)}
        />
        <UsageStatisticsItem
          description={t("statistics.metrics.audioExports.description")}
          icon={<AudioLines />}
          label={t("statistics.metrics.audioExports.label")}
          value={formatStatisticCount(statistics.audioExports, locale)}
        />
      </UsageStatisticsSection>

      <UsageStatisticsSection title={t("statistics.sections.data")}>
        <UsageStatisticsItem
          description={t("statistics.metrics.sourceData.description")}
          icon={<FileInput />}
          label={t("statistics.metrics.sourceData.label")}
          value={formatExportFileSize(statistics.sourceBytes)}
        />
        <UsageStatisticsItem
          description={t("statistics.metrics.outputData.description")}
          icon={<FileOutput />}
          label={t("statistics.metrics.outputData.label")}
          value={formatExportFileSize(statistics.outputBytes)}
        />
        <UsageStatisticsItem
          description={
            storageSavedBytes > 0
              ? t("statistics.metrics.storageSaved.saved")
              : storageSavedBytes < 0
                ? t("statistics.metrics.storageSaved.grew")
                : t("statistics.metrics.storageSaved.unchanged")
          }
          icon={<PiggyBank />}
          label={t("statistics.metrics.storageSaved.label")}
          value={`${sizeChange.sign}${formatExportFileSize(Math.abs(storageSavedBytes))}`}
          valueClassName={sizeChange.className}
          valueIcon={sizeChange.icon}
        />
        <UsageStatisticsItem
          description={
            ratio === null
              ? t("statistics.metrics.dataReduction.unavailable")
              : t("statistics.metrics.dataReduction.description")
          }
          icon={<Percent />}
          label={t("statistics.metrics.dataReduction.label")}
          value={`${ratio === null ? "" : sizeChange.sign}${percentage}`}
          valueClassName={ratio === null ? "text-muted-foreground" : sizeChange.className}
          valueIcon={ratio === null ? undefined : sizeChange.icon}
        />
      </UsageStatisticsSection>

      <UsageStatisticsSection title={t("statistics.sections.activity")}>
        <UsageStatisticsItem
          icon={<CalendarPlus />}
          label={t("statistics.metrics.firstExport.label")}
          value={formatStatisticDate(statistics.firstExportAtMillis, locale, notYet)}
        />
        <UsageStatisticsItem
          description={
            statistics.lastExportAtMillis === null
              ? undefined
              : formatRelativeTime(statistics.lastExportAtMillis * 1_000, locale, notYet)
          }
          icon={<CalendarClock />}
          label={t("statistics.metrics.lastExport.label")}
          value={formatStatisticDate(statistics.lastExportAtMillis, locale, notYet)}
        />
      </UsageStatisticsSection>
    </div>
  );
}

export { UsageStatistics, UsageStatisticsContent, UsageStatisticsDashboard };

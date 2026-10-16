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
  PiggyBank,
  Scissors,
  Timer,
} from "lucide-react";
import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { Item, ItemContent, ItemDescription, ItemMedia } from "@/components/ui/item";
import { ScrollArea } from "@/components/ui/scroll-area";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  selectUsageStatistics,
  selectUsageStatisticsStatus,
} from "@/app/store/slices/usage-statistics-slice";
import { loadUsageStatistics } from "@/app/store/thunks/usage-statistics-thunks";
import { formatExportDuration } from "@/domain/export-metrics";
import { getCompletedExports, getStorageSavedBytes } from "@/domain/usage-statistics";
import { cn } from "@/lib/class-names.utils";
import { formatRelativeTime } from "@/lib/date-time.utils";

import { UsageStatisticsItem } from "./components/UsageStatisticsItem";
import { UsageStatisticsLoading } from "./components/UsageStatisticsLoading";
import { UsageStatisticsSection } from "./components/UsageStatisticsSection";
import { UsageStatisticsUnavailable } from "./components/UsageStatisticsUnavailable";
import {
  formatSignedFileSize,
  formatStatisticCount,
  formatStatisticDate,
} from "./lib/usage-statistics-format.utils";

/** Refreshes the native statistics whenever it mounts, so every opening shows current totals. */
function UsageStatistics({ children }: { children?: React.ReactNode }) {
  const dispatch = useAppDispatch();

  useEffect(() => {
    void dispatch(loadUsageStatistics());
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
  const locale = i18n.resolvedLanguage ?? i18n.language;
  if (!statistics) return null;

  const completedExports = getCompletedExports(statistics);
  const storageSavedBytes = getStorageSavedBytes(statistics);
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
          value={formatSignedFileSize(statistics.sourceBytes)}
        />
        <UsageStatisticsItem
          description={t("statistics.metrics.outputData.description")}
          icon={<FileOutput />}
          label={t("statistics.metrics.outputData.label")}
          value={formatSignedFileSize(statistics.outputBytes)}
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
          value={formatSignedFileSize(storageSavedBytes)}
          valueClassName={storageSavedBytes < 0 ? "text-destructive" : undefined}
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

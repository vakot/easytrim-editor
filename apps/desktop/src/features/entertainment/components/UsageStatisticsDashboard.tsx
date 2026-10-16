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
import { type ReactNode, useId } from "react";
import { useTranslation } from "react-i18next";

import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";

import { useAppSelector } from "@/app/store/redux-hooks";
import { selectUsageStatistics } from "@/app/store/slices/usage-statistics-slice";
import { formatExportDuration } from "@/domain/export-metrics";
import { getCompletedExports, getStorageSavedBytes } from "@/domain/usage-statistics";
import { cn } from "@/lib/class-names.utils";
import { formatRelativeTime } from "@/lib/date-time.utils";

import {
  formatSignedFileSize,
  formatStatisticCount,
  formatStatisticDate,
} from "../lib/usage-statistics-format.utils";

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

      <StatisticsSection title={t("statistics.sections.overview")}>
        <StatisticItem
          description={t("statistics.metrics.completedExports.description")}
          icon={<CircleCheckBig />}
          label={t("statistics.metrics.completedExports.label")}
          value={formatStatisticCount(completedExports, locale)}
        />
        <StatisticItem
          description={t("statistics.metrics.processingTime.description")}
          icon={<Timer />}
          label={t("statistics.metrics.processingTime.label")}
          value={formatExportDuration(statistics.processingMillis)}
        />
      </StatisticsSection>

      <StatisticsSection title={t("statistics.sections.breakdown")}>
        <StatisticItem
          description={t("statistics.metrics.optimizedExports.description")}
          icon={<Clapperboard />}
          label={t("statistics.metrics.optimizedExports.label")}
          value={formatStatisticCount(statistics.optimizedExports, locale)}
        />
        <StatisticItem
          description={t("statistics.metrics.losslessCuts.description")}
          icon={<Scissors />}
          label={t("statistics.metrics.losslessCuts.label")}
          value={formatStatisticCount(statistics.losslessExports, locale)}
        />
        <StatisticItem
          description={t("statistics.metrics.gifExports.description")}
          icon={<ImagePlay />}
          label={t("statistics.metrics.gifExports.label")}
          value={formatStatisticCount(statistics.gifExports, locale)}
        />
        <StatisticItem
          description={t("statistics.metrics.audioExports.description")}
          icon={<AudioLines />}
          label={t("statistics.metrics.audioExports.label")}
          value={formatStatisticCount(statistics.audioExports, locale)}
        />
      </StatisticsSection>

      <StatisticsSection title={t("statistics.sections.data")}>
        <StatisticItem
          description={t("statistics.metrics.sourceData.description")}
          icon={<FileInput />}
          label={t("statistics.metrics.sourceData.label")}
          value={formatSignedFileSize(statistics.sourceBytes)}
        />
        <StatisticItem
          description={t("statistics.metrics.outputData.description")}
          icon={<FileOutput />}
          label={t("statistics.metrics.outputData.label")}
          value={formatSignedFileSize(statistics.outputBytes)}
        />
        <StatisticItem
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
      </StatisticsSection>

      <StatisticsSection title={t("statistics.sections.activity")}>
        <StatisticItem
          icon={<CalendarPlus />}
          label={t("statistics.metrics.firstExport.label")}
          value={formatStatisticDate(statistics.firstExportAtMillis, locale, notYet)}
        />
        <StatisticItem
          description={
            statistics.lastExportAtMillis === null
              ? undefined
              : formatRelativeTime(statistics.lastExportAtMillis * 1_000, locale, notYet)
          }
          icon={<CalendarClock />}
          label={t("statistics.metrics.lastExport.label")}
          value={formatStatisticDate(statistics.lastExportAtMillis, locale, notYet)}
        />
      </StatisticsSection>
    </div>
  );
}

function StatisticsSection({ children, title }: { children: ReactNode; title: string }) {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <h3 className="text-xs font-medium text-muted-foreground" id={headingId}>
        {title}
      </h3>
      <ItemGroup className="grid grid-cols-[repeat(auto-fit,minmax(14rem,1fr))] gap-2">
        {children}
      </ItemGroup>
    </section>
  );
}

function StatisticItem({
  description,
  icon,
  label,
  value,
  valueClassName,
}: {
  description?: string;
  icon: ReactNode;
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <Item role="listitem" size="sm" variant="outline">
      <ItemMedia
        aria-hidden="true"
        className="rounded-md bg-muted p-2 text-muted-foreground"
        variant="icon"
      >
        {icon}
      </ItemMedia>
      <ItemContent className="min-w-0 gap-0.5">
        <ItemTitle className="font-normal text-muted-foreground">{label}</ItemTitle>
        <p
          className={cn(
            "truncate text-lg leading-tight font-semibold tabular-nums",
            valueClassName,
          )}
        >
          {value}
        </p>
        {description ? <ItemDescription className="text-xs">{description}</ItemDescription> : null}
      </ItemContent>
    </Item>
  );
}

export { UsageStatisticsDashboard };

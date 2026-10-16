import { formatExportFileSize } from "@/domain/export-metrics";
import { formatDateTime } from "@/lib/date-time.utils";

function formatStatisticCount(value: number, locale: string): string {
  return new Intl.NumberFormat(locale).format(value);
}

/** Formats a signed byte difference; growth is shown with a leading minus sign. */
function formatSignedFileSize(bytes: number): string {
  const size = formatExportFileSize(Math.abs(bytes));
  return bytes < 0 ? `-${size}` : size;
}

function formatStatisticDate(millis: number | null, locale: string, placeholder: string): string {
  return formatDateTime(millis === null ? undefined : millis * 1_000, locale, placeholder);
}

export { formatSignedFileSize, formatStatisticCount, formatStatisticDate };

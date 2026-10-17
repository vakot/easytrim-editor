import { formatDateTime } from "@/lib/date-time.utils";

function formatStatisticCount(value: number, locale: string): string {
  return new Intl.NumberFormat(locale).format(value);
}

function formatStatisticDate(millis: number | null, locale: string, placeholder: string): string {
  return formatDateTime(millis === null ? undefined : millis * 1_000, locale, placeholder);
}

export { formatStatisticCount, formatStatisticDate };

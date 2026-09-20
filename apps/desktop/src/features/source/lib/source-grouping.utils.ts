import type { EditingInstance } from "@/domain/editing-instance";

export interface SourceGroup<T> {
  items: T[];
  key: string;
  label: string;
}

export function getSourceFolderPath(sourcePath: string): string {
  const separatorIndex = Math.max(sourcePath.lastIndexOf("/"), sourcePath.lastIndexOf("\\"));
  if (separatorIndex < 0) return "";

  const folderPath = sourcePath.slice(0, separatorIndex);
  if (/^[A-Za-z]:$/.test(folderPath)) return sourcePath.slice(0, separatorIndex + 1);
  return folderPath || sourcePath.slice(0, separatorIndex + 1);
}

export function groupSourcesByFolder(
  sources: readonly EditingInstance[],
): SourceGroup<EditingInstance>[] {
  const groups = new Map<string, SourceGroup<EditingInstance>>();

  for (const source of sources) {
    const folderPath = getSourceFolderPath(source.snapshot.source.sourcePath);
    const key = normalizeFolderKey(folderPath);
    const group = groups.get(key);

    if (group) {
      group.items.push(source);
    } else {
      groups.set(key, { items: [source], key, label: folderPath || "." });
    }
  }

  return [...groups.values()];
}

export function groupSourcesByUpdatedTime(
  sources: readonly EditingInstance[],
  locale: string,
  unknownLabel: string,
  now = new Date(),
): SourceGroup<EditingInstance>[] {
  return groupSourcesByTimestamp(
    sources,
    (source) => source.snapshot.source.updatedAtMicros,
    locale,
    unknownLabel,
    now,
  );
}

export function groupSourcesByImportedTime(
  sources: readonly EditingInstance[],
  locale: string,
  unknownLabel: string,
  now = new Date(),
): SourceGroup<EditingInstance>[] {
  const groups = new Map<string, SourceGroup<EditingInstance>>();

  for (const source of sources) {
    const importedAtMicros = source.importedAtMicros;
    const timeGroup = getUpdatedTimeGroup(importedAtMicros, locale, unknownLabel, now);
    const key = importedAtMicros === undefined ? "unknown" : `import:${importedAtMicros}`;
    const existing = groups.get(key);

    if (existing) {
      existing.items.push(source);
    } else {
      groups.set(key, { items: [source], key, label: timeGroup.label });
    }
  }

  return [...groups.values()];
}

function groupSourcesByTimestamp(
  sources: readonly EditingInstance[],
  getTimestamp: (source: EditingInstance) => number | undefined,
  locale: string,
  unknownLabel: string,
  now: Date,
): SourceGroup<EditingInstance>[] {
  const groups = new Map<string, SourceGroup<EditingInstance>>();

  for (const source of sources) {
    const group = getUpdatedTimeGroup(getTimestamp(source), locale, unknownLabel, now);
    const existing = groups.get(group.key);

    if (existing) {
      existing.items.push(source);
    } else {
      groups.set(group.key, { items: [source], ...group });
    }
  }

  return [...groups.values()];
}

function getUpdatedTimeGroup(
  updatedAtMicros: number | undefined,
  locale: string,
  unknownLabel: string,
  now: Date,
): Pick<SourceGroup<EditingInstance>, "key" | "label"> {
  if (updatedAtMicros === undefined) return { key: "unknown", label: unknownLabel };

  const updatedAt = new Date(updatedAtMicros / 1_000);
  if (Number.isNaN(updatedAt.getTime())) return { key: "unknown", label: unknownLabel };

  const elapsedMs = now.getTime() - updatedAt.getTime();
  if (elapsedMs < 0) return absoluteDateGroup(updatedAt, locale);

  const elapsedMinutes = Math.floor(elapsedMs / MINUTE_MS);
  if (elapsedMinutes < 60) {
    return {
      key: `minute:${elapsedMinutes}`,
      label: new Intl.RelativeTimeFormat(locale, { numeric: "always" }).format(
        -elapsedMinutes,
        "minute",
      ),
    };
  }

  const elapsedHours = Math.floor(elapsedMs / HOUR_MS);
  if (elapsedHours < 24 && isSameCalendarDay(updatedAt, now)) {
    return {
      key: `hour:${elapsedHours}`,
      label: new Intl.RelativeTimeFormat(locale, { numeric: "always" }).format(
        -elapsedHours,
        "hour",
      ),
    };
  }

  if (isYesterday(updatedAt, now)) {
    return {
      key: "yesterday",
      label: new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(-1, "day"),
    };
  }

  return absoluteDateGroup(updatedAt, locale);
}

function absoluteDateGroup(
  date: Date,
  locale: string,
): Pick<SourceGroup<EditingInstance>, "key" | "label"> {
  const dateKey = [date.getFullYear(), date.getMonth(), date.getDate()].join("-");
  return {
    key: `date:${dateKey}`,
    label: new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(date),
  };
}

function isSameCalendarDay(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function isYesterday(date: Date, now: Date): boolean {
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  return (
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate()
  );
}

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

function normalizeFolderKey(folderPath: string): string {
  const normalized = folderPath.replace(/[\\/]+/g, "/");
  return /^[A-Za-z]:\//.test(normalized) ? normalized.toLowerCase() : normalized;
}

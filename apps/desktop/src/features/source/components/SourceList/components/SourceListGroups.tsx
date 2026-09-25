import type { LucideIcon } from "lucide-react";
import { ChevronRight, Clock3, Folder, FolderOpen, Upload, X } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { RelativeTimestamp } from "@/components/ui/relative-timestamp";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { VirtualList } from "@/components/ui/virtual-list";

import type { EditingInstance } from "@/domain/editing-instance";
import { useRelativeTimeNow } from "@/lib/hooks/use-relative-time";

import {
  groupSourcesByFolder,
  groupSourcesByImportedTime,
  groupSourcesByUpdatedTime,
  type SourceGroup,
} from "../../../lib/source-grouping.utils";
import { CloseSources } from "../../SourceMenuActions";
import { useSourceListData } from "../contexts/SourceListContext";

import { SourceListItem } from "./SourceListItem";

type SourceGroupIcon = LucideIcon | { closed: LucideIcon; open: LucideIcon };
type SourceRow = { kind: "source"; source: EditingInstance };
type GroupRow = {
  collapsed: boolean;
  group: SourceGroup<EditingInstance>;
  icon: SourceGroupIcon;
  kind: "group";
};
type ListRow = SourceRow | GroupRow;
type PresentedRow = { animation: "entering" | "exiting" | "none"; row: ListRow };
const DEFAULT_GROUP_ICON: SourceGroupIcon = { closed: Folder, open: FolderOpen };

const SOURCE_ROW_ESTIMATE = 128;
const GROUP_ROW_ESTIMATE = 36;
const INITIAL_EXPOSED_ROW_COUNT = 32;
const EXPOSED_ROW_BATCH_SIZE = 32;
const EXPOSED_RANGE_THRESHOLD = 8;
const SOURCE_ROW_TRANSITION_DURATION = 0.16;

function getRowKey(row: ListRow) {
  return row.kind === "group" ? `group:${row.group.key}` : `source:${row.source.id}`;
}

function SourceListNone({ sources }: { sources: EditingInstance[] }) {
  return (
    <SourceListVirtualRows
      dataSlot="imported-sources-grid"
      rows={sources.map((source) => ({ kind: "source", source }))}
    />
  );
}

function SourceListFolder({ sources }: { sources: EditingInstance[] }) {
  const groups = groupSourcesByFolder(sources);
  return <SourceListGroupedRows dataSlot="imported-sources-folders" groups={groups} />;
}

function SourceListTime({ sources }: { sources: EditingInstance[] }) {
  const { i18n, t } = useTranslation();
  const now = useRelativeTimeNow();
  const groups = groupSourcesByUpdatedTime(
    sources,
    i18n.language,
    t("common.status.unknown"),
    new Date(now),
  );

  return (
    <SourceListGroupedRows dataSlot="imported-sources-time-groups" groups={groups} icon={Clock3} />
  );
}

function SourceListImported({ sources }: { sources: EditingInstance[] }) {
  const { i18n, t } = useTranslation();
  const now = useRelativeTimeNow();
  const groups = groupSourcesByImportedTime(
    sources,
    i18n.language,
    t("common.status.unknown"),
    new Date(now),
  );

  return (
    <SourceListGroupedRows
      dataSlot="imported-sources-import-groups"
      groups={groups}
      icon={Upload}
    />
  );
}

function SourceListGroupedRows({
  dataSlot,
  groups,
  icon = DEFAULT_GROUP_ICON,
}: {
  dataSlot: string;
  groups: SourceGroup<EditingInstance>[];
  icon?: SourceGroupIcon;
}) {
  const [collapsedGroups, setCollapsedGroups] = useState<ReadonlySet<string>>(() => new Set());
  const rows = useMemo(() => {
    const flattenedRows: ListRow[] = [];

    for (const group of groups) {
      const collapsed = collapsedGroups.has(group.key);
      flattenedRows.push({ collapsed, kind: "group", group, icon });
      if (collapsed) continue;
      for (const source of group.items) flattenedRows.push({ kind: "source", source });
    }

    return flattenedRows;
  }, [collapsedGroups, groups, icon]);

  const toggleGroup = (key: string) => {
    setCollapsedGroups((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return <SourceListVirtualRows dataSlot={dataSlot} onToggleGroup={toggleGroup} rows={rows} />;
}

function SourceListVirtualRows({
  dataSlot,
  onToggleGroup,
  rows,
}: {
  dataSlot: string;
  onToggleGroup?: (key: string) => void;
  rows: ListRow[];
}) {
  const { allSourceIds, matchesBySourceId } = useSourceListData();
  const shouldReduceMotion = useReducedMotion() === true;
  const duration = shouldReduceMotion ? 0 : SOURCE_ROW_TRANSITION_DURATION;
  const [presentedRows, setPresentedRows] = useState<PresentedRow[]>(() =>
    rows.map((row) => ({ animation: "none", row })),
  );

  const [exposedCount, setExposedCount] = useState(() =>
    Math.min(rows.length, INITIAL_EXPOSED_ROW_COUNT),
  );

  const presentationRef = useRef(presentedRows);
  const exposedCountRef = useRef(exposedCount);
  const previousSourceIdsRef = useRef(new Set(allSourceIds));
  const timersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const exitingKeys = useMemo(
    () =>
      presentedRows
        .filter(({ animation }) => animation === "exiting")
        .map(({ row }) => getRowKey(row)),
    [presentedRows],
  );

  const enteringKeys = useMemo(
    () =>
      presentedRows
        .filter(({ animation }) => animation === "entering")
        .map(({ row }) => getRowKey(row)),
    [presentedRows],
  );

  useLayoutEffect(() => {
    presentationRef.current = presentedRows;
  }, [presentedRows]);

  useLayoutEffect(() => {
    exposedCountRef.current = exposedCount;
  }, [exposedCount]);

  useLayoutEffect(() => {
    const previousSourceIds = previousSourceIdsRef.current;
    const addedSourceIds = new Set([...allSourceIds].filter((id) => !previousSourceIds.has(id)));
    const removedSourceIds = new Set([...previousSourceIds].filter((id) => !allSourceIds.has(id)));
    previousSourceIdsRef.current = new Set(allSourceIds);

    const current = presentationRef.current;
    const previousByKey = new Map(current.map((entry) => [getRowKey(entry.row), entry]));
    const nextKeys = new Set(rows.map(getRowKey));
    const nextExposedCount = Math.min(
      Math.max(exposedCountRef.current, INITIAL_EXPOSED_ROW_COUNT),
      rows.length,
    );

    const next = rows.map((row, index): PresentedRow => {
      const key = getRowKey(row);
      const previous = previousByKey.get(key);
      if (previous) {
        const reappeared = row.kind === "source" && addedSourceIds.has(row.source.id);
        return {
          animation: reappeared
            ? "entering"
            : previous.animation === "exiting"
              ? "none"
              : previous.animation,
          row,
        };
      }

      const shouldAnimateAddition =
        row.kind === "source" && addedSourceIds.has(row.source.id) && index < nextExposedCount;

      return { animation: shouldAnimateAddition ? "entering" : "none", row };
    });

    for (const [previousIndex, previous] of current.entries()) {
      const { row } = previous;
      if (
        row.kind === "source" &&
        !nextKeys.has(getRowKey(row)) &&
        (removedSourceIds.has(row.source.id) || previous.animation === "exiting")
      ) {
        const followingKey = current
          .slice(previousIndex + 1)
          .map(({ row: followingRow }) => getRowKey(followingRow))
          .find((key) => next.some(({ row: nextRow }) => getRowKey(nextRow) === key));

        const insertionIndex = followingKey
          ? next.findIndex(({ row: nextRow }) => getRowKey(nextRow) === followingKey)
          : -1;

        const exitingRow = { ...previous, animation: "exiting" as const };
        if (insertionIndex >= 0) next.splice(insertionIndex, 0, exitingRow);
        else next.push(exitingRow);
      }
    }

    presentationRef.current = next;
    setPresentedRows(next);
    setExposedCount(nextExposedCount);
  }, [allSourceIds, rows]);

  const handleVirtualRangeChange = useCallback(
    (range: { endIndex: number; startIndex: number } | null) => {
      if (!range) return;

      setExposedCount((current) => {
        if (range.endIndex < current - EXPOSED_RANGE_THRESHOLD) return current;
        const rowCount = presentedRows.length;
        if (current >= rowCount) return current;
        return Math.min(current + EXPOSED_ROW_BATCH_SIZE, rowCount);
      });
    },
    [presentedRows.length],
  );

  useEffect(() => {
    const exiting = new Set(exitingKeys);
    const entering = new Set(enteringKeys);

    for (const [key, timer] of timersRef.current) {
      if (!exiting.has(key) && !entering.has(key)) {
        clearTimeout(timer);
        timersRef.current.delete(key);
      }
    }

    for (const key of exiting) {
      if (timersRef.current.has(key)) continue;
      timersRef.current.set(
        key,
        setTimeout(() => {
          timersRef.current.delete(key);
          setPresentedRows((current) => current.filter(({ row }) => getRowKey(row) !== key));
        }, duration * 1000),
      );
    }

    for (const key of entering) {
      if (timersRef.current.has(key)) continue;
      timersRef.current.set(
        key,
        setTimeout(() => {
          timersRef.current.delete(key);
          setPresentedRows((current) =>
            current.map((entry) =>
              getRowKey(entry.row) === key && entry.animation === "entering"
                ? { ...entry, animation: "none" }
                : entry,
            ),
          );
        }, duration * 1000),
      );
    }
  }, [duration, enteringKeys, exitingKeys]);

  useEffect(
    () => () => {
      for (const timer of timersRef.current.values()) clearTimeout(timer);
    },
    [],
  );

  const exposedRows = useMemo(
    () => presentedRows.slice(0, exposedCount),
    [exposedCount, presentedRows],
  );

  const getPresentedRowKey = useCallback((entry: PresentedRow) => getRowKey(entry.row), []);
  const estimatePresentedRowSize = useCallback(
    (index: number) =>
      exposedRows[index]?.row.kind === "group" ? GROUP_ROW_ESTIMATE : SOURCE_ROW_ESTIMATE,
    [exposedRows],
  );

  return (
    <div data-slot={dataSlot} role="list">
      <VirtualList
        estimateSize={estimatePresentedRowSize}
        getItemKey={getPresentedRowKey}
        items={exposedRows}
        onVirtualRangeChange={handleVirtualRangeChange}
        renderItem={(entry) => {
          const row = entry.row;
          if (row.kind === "group") {
            return (
              <SourceListGroupHeader
                collapsed={row.collapsed}
                group={row.group}
                icon={row.icon}
                onToggle={() => onToggleGroup?.(row.group.key)}
              />
            );
          }

          return (
            <SourceListItem
              animation={entry.animation}
              match={matchesBySourceId.get(row.source.id)}
              source={row.source}
            />
          );
        }}
      />
    </div>
  );
}

function SourceListGroupHeader({
  collapsed,
  group,
  icon,
  onToggle,
}: {
  collapsed: boolean;
  group: SourceGroup<EditingInstance>;
  icon: SourceGroupIcon;
  onToggle: () => void;
}) {
  const Icon = "open" in icon ? (collapsed ? icon.closed : icon.open) : icon;
  const { t } = useTranslation();
  const closeLabel = t("source.actions.closeGroup");

  return (
    <div className="flex gap-2 bg-card ring-2 ring-card" role="listitem">
      <Button
        aria-expanded={!collapsed}
        className="flex-1 justify-baseline"
        onClick={onToggle}
        size="sm"
        variant="ghost"
      >
        <ChevronRight
          className={collapsed ? "transition-transform" : "rotate-90 transition-transform"}
        />
        <Icon className="size-3.5 shrink-0" />
        {group.timestampMicros === undefined ? (
          <span className="truncate" title={group.label}>
            {group.label}
          </span>
        ) : (
          <RelativeTimestamp timestamp={group.timestampMicros} />
        )}
      </Button>

      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">
            <CloseSources sources={group.items}>
              <Button aria-label={closeLabel} size="icon-sm" variant="destructive">
                <X aria-hidden="true" />
              </Button>
            </CloseSources>
          </span>
        </TooltipTrigger>
        <TooltipContent>{closeLabel}</TooltipContent>
      </Tooltip>
    </div>
  );
}

export { SourceListFolder, SourceListImported, SourceListNone, SourceListTime };

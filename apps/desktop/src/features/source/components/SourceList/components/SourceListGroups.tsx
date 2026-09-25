import type { LucideIcon } from "lucide-react";
import { ChevronRight, Clock3, Folder, FolderOpen, Upload, X } from "lucide-react";
import { useMemo, useState } from "react";
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
const DEFAULT_GROUP_ICON: SourceGroupIcon = { closed: Folder, open: FolderOpen };

const SOURCE_ROW_ESTIMATE = 128;
const GROUP_ROW_ESTIMATE = 36;

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
  const { matchesBySourceId } = useSourceListData();

  return (
    <div data-slot={dataSlot} role="list">
      <VirtualList
        estimateSize={(index) =>
          rows[index]?.kind === "group" ? GROUP_ROW_ESTIMATE : SOURCE_ROW_ESTIMATE
        }
        getItemKey={(row) =>
          row.kind === "group" ? `group:${row.group.key}` : `source:${row.source.id}`
        }
        items={rows}
        renderItem={(row) =>
          row.kind === "group" ? (
            <SourceListGroupHeader
              collapsed={row.collapsed}
              group={row.group}
              icon={row.icon}
              onToggle={() => onToggleGroup?.(row.group.key)}
            />
          ) : (
            <SourceListItem match={matchesBySourceId.get(row.source.id)} source={row.source} />
          )
        }
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

import { ChevronRight, Clock3, Folder, Upload, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { TabsContent } from "@/components/ui/tabs";
import { VirtualList } from "@/components/ui/virtual-list";

import type { EditingInstanceListEntry } from "@/domain/editing-instance";

import {
  groupSourcesByFolder,
  groupSourcesByImportedTime,
  groupSourcesByUpdatedTime,
  type SourceGroup,
} from "../../../lib/source-grouping.utils";
import { CloseSources } from "../../SourceMenuActions";
import { useSourceListData } from "../contexts/SourceListContext";

import { SourceListItem } from "./SourceListItem";

const SOURCE_ROW_HEIGHT = 72;
const GROUP_ROW_HEIGHT = 36;
const LIST_OVERSCAN = 8;

function SourceListContent() {
  const { i18n, t } = useTranslation();
  const { addedSourceIds, consumeSourceAddition, matchesBySourceId, search, sources, tab } =
    useSourceListData();

  const [collapsedGroupKeys, setCollapsedGroupKeys] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  const rows = useMemo(() => {
    if (tab === "none") {
      return sources.map(({ id }) => ({
        kind: "source" as const,
        key: `source:${id}`,
        sourceId: id,
      }));
    }

    const groups =
      tab === "folder"
        ? groupSourcesByFolder(sources)
        : tab === "time"
          ? groupSourcesByUpdatedTime(
              sources,
              i18n.language,
              t("common.status.unknown"),
              new Date(),
            )
          : groupSourcesByImportedTime(
              sources,
              i18n.language,
              t("common.status.unknown"),
              new Date(),
            );

    return groups.flatMap((group) => [
      { kind: "group" as const, group, key: `group:${tab}:${group.key}` },
      ...(!collapsedGroupKeys.has(`${tab}:${group.key}`)
        ? group.items.map(({ id }) => ({
            kind: "source" as const,
            key: `source:${id}`,
            sourceId: id,
          }))
        : []),
    ]);
  }, [collapsedGroupKeys, i18n.language, sources, t, tab]);

  const toggleGroup = (key: string) => {
    setCollapsedGroupKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  if (search.trim() && sources.length === 0) {
    return (
      <div className="text-center text-sm text-muted-foreground" role="status">
        {t("source.messages.noSearchResults")}
      </div>
    );
  }

  return (
    <TabsContent className="min-h-0 min-w-0 flex-1" value={tab}>
      <VirtualList
        className="min-w-0"
        estimateSize={(index) =>
          rows[index]?.kind === "group" ? GROUP_ROW_HEIGHT : SOURCE_ROW_HEIGHT
        }
        getItemKey={(index) => rows[index]?.key ?? `missing:${index}`}
        items={rows}
        overscan={LIST_OVERSCAN}
        renderItem={(row) =>
          row.kind === "group" ? (
            <GroupRow
              collapsed={collapsedGroupKeys.has(`${tab}:${row.group.key}`)}
              group={row.group}
              icon={tab === "folder" ? Folder : tab === "time" ? Clock3 : Upload}
              onToggle={() => toggleGroup(`${tab}:${row.group.key}`)}
            />
          ) : (
            <SourceListItem
              isAdded={addedSourceIds.has(row.sourceId)}
              match={matchesBySourceId.get(row.sourceId)}
              onAdditionAnimationStart={consumeSourceAddition}
              sourceId={row.sourceId}
            />
          )
        }
      />
    </TabsContent>
  );
}

function GroupRow({
  collapsed,
  group,
  icon: Icon,
  onToggle,
}: {
  collapsed: boolean;
  group: SourceGroup<EditingInstanceListEntry>;
  icon: typeof Folder;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  const groupLabel = group.label;

  return (
    <div className="flex h-9 min-w-0 items-center gap-2 border-b bg-card px-2">
      <Button
        aria-expanded={!collapsed}
        className="h-8 min-w-0 flex-1 justify-start truncate px-2"
        onClick={onToggle}
        size="sm"
        variant="ghost"
      >
        <ChevronRight
          aria-hidden="true"
          className="size-3.5 shrink-0 transition-transform aria-expanded:rotate-90"
        />
        <Icon aria-hidden="true" className="size-3.5 shrink-0" />
        <span className="truncate" title={groupLabel}>
          {groupLabel}
        </span>
      </Button>
      <CloseSources sources={group.items}>
        <Button aria-label={t("source.actions.closeGroup")} size="icon-xs" variant="destructive">
          <X aria-hidden="true" />
        </Button>
      </CloseSources>
    </div>
  );
}

export { SourceListContent };

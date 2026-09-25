import type { LucideIcon } from "lucide-react";
import { ChevronRight, Clock3, Folder, FolderOpen, Upload, X } from "lucide-react";
import { AnimatePresence } from "motion/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Highlight } from "@/components/ui/highlight";
import { RelativeTimestamp } from "@/components/ui/relative-timestamp";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

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

type SourceGroupIcon =
  | LucideIcon
  | {
      closed: LucideIcon;
      open: LucideIcon;
    };

function SourceListNone({ sources }: { sources: EditingInstance[] }) {
  return <SourceListGrid sources={sources} />;
}

function SourceListFolder({ sources }: { sources: EditingInstance[] }) {
  const folders = groupSourcesByFolder(sources);

  return <SourceListGroups dataSlot="imported-sources-folders" groups={folders} />;
}

function SourceListGroup({
  group,
  icon,
}: {
  group: SourceGroup<EditingInstance>;
  icon: SourceGroupIcon;
}) {
  const [open, setOpen] = useState(true);
  const Icon = "open" in icon ? (open ? icon.open : icon.closed) : icon;
  const { search } = useSourceListData();
  const { t } = useTranslation();
  const closeLabel = t("source.actions.closeGroup");

  return (
    <li>
      <Collapsible defaultOpen onOpenChange={setOpen}>
        <div className="sticky top-0 z-10 flex gap-2 bg-card ring-2 ring-card">
          <CollapsibleTrigger asChild>
            <Button className="flex-1 justify-baseline" size="sm" variant="ghost">
              <ChevronRight className="transition-transform group-data-open/button:rotate-90" />
              <Icon className="size-3.5 shrink-0" />
              {group.timestampMicros === undefined ? (
                <span className="truncate" title={group.label}>
                  <Highlight query={search}>{group.label}</Highlight>
                </span>
              ) : (
                <RelativeTimestamp timestamp={group.timestampMicros} />
              )}
            </Button>
          </CollapsibleTrigger>

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

        <CollapsibleContent className="mt-2">
          <SourceListGrid sources={group.items} />
        </CollapsibleContent>
      </Collapsible>
    </li>
  );
}

function SourceListGroups({
  dataSlot,
  groups,
  icon,
}: {
  dataSlot: string;
  groups: SourceGroup<EditingInstance>[];
  icon?: SourceGroupIcon;
}) {
  return (
    <ul className="flex flex-col gap-2" data-slot={dataSlot}>
      {groups.map((group) => (
        <SourceListGroup
          group={group}
          icon={icon ?? { closed: Folder, open: FolderOpen }}
          key={group.key}
        />
      ))}
    </ul>
  );
}

function SourceListGrid({ sources }: { sources: EditingInstance[] }) {
  const { search } = useSourceListData();

  return (
    <ul className="flex flex-col gap-2" data-slot="imported-sources-grid">
      <AnimatePresence>
        {sources.map((source) => (
          <SourceListItem key={source.id} search={search} source={source} />
        ))}
      </AnimatePresence>
    </ul>
  );
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

  return <SourceListGroups dataSlot="imported-sources-time-groups" groups={groups} icon={Clock3} />;
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
    <SourceListGroups dataSlot="imported-sources-import-groups" groups={groups} icon={Upload} />
  );
}

export {
  SourceListFolder,
  SourceListGrid,
  SourceListGroups,
  SourceListImported,
  SourceListNone,
  SourceListTime,
};

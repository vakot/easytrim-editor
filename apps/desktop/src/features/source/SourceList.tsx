import type { TFunction } from "i18next";
import type { LucideIcon } from "lucide-react";
import {
  ChevronRight,
  Clock3,
  ExternalLink,
  FileVideo2,
  Folder,
  FolderCode,
  FolderOpen,
  MoreHorizontal,
  Play,
  RotateCcw,
  Scissors,
  Search,
  Settings2,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import React, { createContext, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Highlight } from "@/components/ui/highlight";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { RelativeTimestamp } from "@/components/ui/relative-timestamp";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  selectEditingInstanceById,
  selectExportQueueById,
  selectImportedEditingInstances,
} from "@/app/store/slices/editing-instances-slice";
import { selectSourceExportQueueState } from "@/app/store/slices/export-slice";
import { cancelExportAttemptRequested } from "@/app/store/thunks/export-thunks";
import {
  chooseSourceRequested,
  prepareImportedSourceMetadataRequested,
  prepareImportedSourceThumbnailsRequested,
  restoreExportAttemptRequested,
} from "@/app/store/thunks/source-media-thunks";
import type { EditingInstance, ExportAttempt, ExportAttemptState } from "@/domain/editing-instance";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { useRelativeTimeNow } from "@/lib/hooks/use-relative-time";
import { useKeyboardShortcut } from "@/lib/hooks/useKeyboardShortcut";
import { openFileLocation } from "@/lib/tauri/media";

import {
  SourceCard,
  SourceCardActions,
  SourceCardDescription,
  SourceCardMetadata,
  SourceCardStatusBadge,
  SourceCardThumbnail,
  SourceCardTitle,
} from "./components/SourceCard";
import {
  CancelSourceExport,
  CloseSource,
  DeleteSource,
  RestoreSource,
  StartSourceExport,
} from "./components/SourceMenuActions";
import { formatSourcePath } from "./lib/media-formatters.utils";
import { getRevealLabel } from "./lib/source.utils";
import {
  groupSourcesByFolder,
  groupSourcesByImportedTime,
  groupSourcesByUpdatedTime,
  type SourceGroup,
} from "./lib/source-grouping.utils";
import { filterSourcesByPath } from "./lib/source-search.utils";

interface SourceListProps {
  children?: React.ReactNode | ((state: Omit<SourceListState, "setSearch">) => React.ReactNode);
}

const SOURCE_SEARCH_DEBOUNCE_MS = 250;
type SourceListTab = "none" | "folder" | "time" | "imported";
type SourceListState = {
  search: string;
  setSearch: (value: string) => void;
  sources: EditingInstance[];
  tab: SourceListTab;
};

function SourceList({ children }: SourceListProps) {
  const sources = usePrepareSources();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<SourceListTab>("none");

  const filteredSources = React.useMemo(
    () => filterSourcesByPath(sources, search),
    [search, sources],
  );

  if (sources.length === 0) return <SourceListEmptyState />;

  const child =
    typeof children === "function" ? children({ search, sources: filteredSources, tab }) : children;

  return (
    <SourceListData.Provider value={{ search, setSearch, sources: filteredSources, tab }}>
      <Tabs
        className="min-h-0 flex-1"
        onValueChange={(value) => setTab(value as SourceListTab)}
        value={tab}
      >
        {child ?? <SourceListContent />}
      </Tabs>
    </SourceListData.Provider>
  );
}

function SourceListTabs() {
  const { t } = useTranslation();

  return (
    <TabsList className="min-w-0 flex-1" defaultValue="none">
      <TabsTrigger value="none">{t("source.labels.groupByNone")}</TabsTrigger>
      <TabsTrigger value="folder">{t("source.labels.groupByFolder")}</TabsTrigger>
      <TabsTrigger value="time">{t("source.labels.groupByUpdatedAt")}</TabsTrigger>
      <TabsTrigger value="imported">{t("source.labels.groupByImportedAt")}</TabsTrigger>
    </TabsList>
  );
}

function SourceListSearch() {
  const { t } = useTranslation();
  const { setSearch, sources } = useSourceListData();

  const [searchInternal, setSearchInternal] = useState("");
  const debouncedSearch = useDebouncedValue(searchInternal, SOURCE_SEARCH_DEBOUNCE_MS);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const isFiltered = debouncedSearch.trim().length > 0;

  useEffect(() => {
    setSearch(debouncedSearch);
  }, [setSearch, debouncedSearch]);

  useKeyboardShortcut(
    (event) => event.code === "KeyK" && event.ctrlKey,
    () => searchInputRef.current?.focus(),
  );

  return (
    <InputGroup>
      <InputGroupAddon>
        <Search aria-hidden="true" />
      </InputGroupAddon>
      <InputGroupInput
        aria-label={t("common.labels.search")}
        onChange={(event) => setSearchInternal(event.currentTarget.value)}
        placeholder={t("common.labels.search")}
        ref={searchInputRef}
        type="search"
        value={searchInternal}
      />
      <InputGroupAddon align="inline-end" className="gap-1 py-0 pr-1">
        {isFiltered ? (
          <>
            <InputGroupButton
              aria-label={t("common.actions.clear")}
              onClick={() => setSearchInternal("")}
              size="icon-xs"
              type="button"
              variant="ghost"
            >
              <X aria-hidden="true" />
            </InputGroupButton>
            <span className="pr-1">{sources.length} Results</span>
          </>
        ) : (
          <KbdGroup aria-label="Ctrl + K">
            <Kbd>Ctrl</Kbd>
            <Kbd>K</Kbd>
          </KbdGroup>
        )}
      </InputGroupAddon>
    </InputGroup>
  );
}

function SourceListContent() {
  const { search, sources } = useSourceListData();
  const { t } = useTranslation();

  if (search.trim() && sources.length === 0) {
    return (
      <div className="px-2 py-4 text-center text-sm text-muted-foreground" role="status">
        {t("source.messages.noSearchResults")}
      </div>
    );
  }

  return (
    <>
      <TabsContent value="none">
        <SourceListNone sources={sources} />
      </TabsContent>
      <TabsContent value="folder">
        <SourceListFolder sources={sources} />
      </TabsContent>
      <TabsContent value="time">
        <SourceListTime sources={sources} />
      </TabsContent>
      <TabsContent value="imported">
        <SourceListImported sources={sources} />
      </TabsContent>
    </>
  );
}

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

  return (
    <li>
      <Collapsible defaultOpen onOpenChange={setOpen}>
        <div className="sticky top-0 z-10 bg-card ring-2 ring-card">
          <CollapsibleTrigger asChild>
            <Button className="w-full justify-baseline" size="sm" variant="ghost">
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

type SourceGroupIcon =
  | LucideIcon
  | {
      closed: LucideIcon;
      open: LucideIcon;
    };

function SourceListGrid({ sources }: { sources: EditingInstance[] }) {
  const { search } = useSourceListData();

  return (
    <ul className="flex flex-col gap-2 py-0.5" data-slot="imported-sources-grid">
      {sources.map((source) => (
        <SourceListItem key={source.id} search={search} source={source} />
      ))}
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

function SourceListEmptyState() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  return (
    <section
      aria-label={t("source.labels.explorer")}
      className="flex min-h-full w-full items-center justify-center px-3 py-8"
    >
      <Empty className="w-full max-w-xl border-0 p-0">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FolderCode aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>{t("source.messages.emptyTitle")}</EmptyTitle>
          <EmptyDescription>{t("source.messages.emptyDescription")}</EmptyDescription>
        </EmptyHeader>

        <EmptyContent>
          <div className="grid w-full gap-3">
            <SourceListEmptyStateAction
              description={t("source.messages.openFileDescription")}
              icon={<FileVideo2 aria-hidden="true" />}
              keys={["Ctrl", "O"]}
              label={t("app.actions.openFile")}
              onClick={() =>
                void dispatch(chooseSourceRequested({ id: "explorer.open-file", type: "button" }))
              }
            />
            <SourceListEmptyStateAction
              description={t("source.messages.openFolderDescription")}
              icon={<FolderOpen aria-hidden="true" />}
              keys={["Ctrl", "K"]}
              label={t("app.actions.openFolder")}
              onClick={() =>
                void dispatch(
                  chooseSourceRequested({ id: "explorer.open-folder", type: "button" }, "folders"),
                )
              }
            />
          </div>

          <div className="flex w-full items-center gap-2">
            <Separator className="flex-1" />
            <span className="text-muted-foreground">{t("common.labels.or")}</span>
            <Separator className="flex-1" />
          </div>

          <div className="grid w-full justify-items-center gap-2 rounded-lg border border-dashed border-border/80 bg-muted/20 px-4 py-6 text-center">
            <span className="grid size-10 place-items-center rounded-full bg-primary/12 text-primary">
              <Upload aria-hidden="true" className="size-5" />
            </span>
            <strong className="text-sm">{t("source.messages.dropTitle")}</strong>
            <span className="text-xs font-medium text-primary">
              {t("source.messages.extensions")}
            </span>
            <span className="text-xs text-muted-foreground">
              {t("source.messages.dropDescription")}
            </span>
          </div>
        </EmptyContent>
      </Empty>
    </section>
  );
}

function SourceListEmptyStateAction({
  description,
  icon,
  keys,
  label,
  onClick,
}: {
  description: string;
  icon: ReactNode;
  keys: readonly string[];
  label: string;
  onClick: () => void;
}) {
  return (
    <div className="grid gap-1">
      <span className="text-xs text-muted-foreground">{description}</span>
      <Button className="w-full justify-between" onClick={onClick} type="button">
        <span className="flex items-center gap-2">
          {icon}
          {label}
        </span>
        <KbdGroup aria-label={keys.join(" + ")}>
          {keys.map((key) => (
            <Kbd key={key}>{key}</Kbd>
          ))}
        </KbdGroup>
      </Button>
    </div>
  );
}

function SourceListItem({ search, source }: { search: string; source: EditingInstance }) {
  return (
    <li className="flex w-full flex-col">
      <SourceListItemCard search={search} source={source} />
      <SourceListItemExtra source={source} />
    </li>
  );
}

function SourceListItemCard({ search, source }: { search: string; source: EditingInstance }) {
  const { t } = useTranslation();

  return (
    <SourceCard className="z-1 flex flex-row gap-2 p-2" source={source}>
      <SourceCardThumbnail className="w-6/11 shrink-0 rounded-md shadow">
        <SourceCardStatusBadge className="absolute top-2 left-2" />
      </SourceCardThumbnail>

      <div className="relative flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex min-w-0 flex-col gap-1" data-slot="card-header">
          <SourceCardTitle className="line-clamp-2 wrap-break-word whitespace-normal">
            {({ source: cardSource }) => (
              <Highlight query={search}>{cardSource.snapshot.source.displayName}</Highlight>
            )}
          </SourceCardTitle>
          <SourceCardDescription className="line-clamp-2 wrap-anywhere whitespace-normal">
            {({ source: cardSource }) => (
              <Highlight query={search}>
                {formatSourcePath(cardSource.snapshot.source.sourcePath)}
              </Highlight>
            )}
          </SourceCardDescription>
        </div>

        <SourceCardMetadata />

        <SourceCardActions className="invisible absolute right-0 bottom-0 transition-none group-hover/source-card:visible">
          <Button
            aria-label={`${t("source.actions.sourceActions")}: ${source.snapshot.source.displayName}`}
            className="transition-none"
            size="icon-sm"
            variant="secondary"
          >
            <MoreHorizontal aria-hidden="true" />
          </Button>
        </SourceCardActions>
      </div>
    </SourceCard>
  );
}

const sourceListItemExtraClassName = "min-h-8 border-t bg-muted/50 p-1 first:border-t-0";

function SourceListItemExtra({ source }: { source: EditingInstance }) {
  if (source.sourceAvailability !== "deleted" && source.exportAttempts.length === 0) return null;

  return (
    <div className="mt-px w-full px-3">
      <ul className="flex flex-col overflow-hidden rounded-b-lg border border-t-0">
        <SourceListItemExports sourceId={source.id} />
        <li className={`${sourceListItemExtraClassName} flex gap-1`}>
          <SourceListItemActions source={source} />
        </li>
      </ul>
    </div>
  );
}

function SourceListItemExports({ sourceId }: { sourceId: string }) {
  const items = useAppSelector((state) => selectExportQueueById(state, sourceId));

  if (items.length === 0) return null;

  return items.map(({ attempt }) => (
    <li className={sourceListItemExtraClassName} key={attempt.id}>
      <SourceListItemExport attempt={attempt} instanceId={sourceId} />
    </li>
  ));
}

function SourceListItemExport({
  attempt,
  instanceId,
}: {
  attempt: ExportAttempt;
  instanceId: string;
}) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const sourceAvailable = useAppSelector(
    (state) => selectEditingInstanceById(state, instanceId)?.sourceAvailability === "available",
  );

  const statusLabel = getExportQueueItemStatusLabel(t, attempt.state.status);

  return (
    <div className="flex min-w-0 items-center gap-1">
      <Button
        className="min-w-0 flex-1 justify-between gap-2 disabled:opacity-100"
        disabled={!sourceAvailable || attempt.state.status === "rendering"}
        onClick={() =>
          void dispatch(restoreExportAttemptRequested({ instanceId, attemptId: attempt.id }))
        }
        size="xs"
        variant="ghost"
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {attempt.route === "fast" ? (
            <Scissors aria-hidden="true" className="shrink-0" />
          ) : (
            <Settings2 aria-hidden="true" className="shrink-0" />
          )}
          <span
            className="min-w-0 truncate text-xs text-muted-foreground"
            title={attempt.output.displayName}
          >
            {attempt.output.displayName}
          </span>
        </div>

        <Badge className="shrink-0 whitespace-nowrap text-muted-foreground" variant="outline">
          <span className={attempt.state.status === "rendering" ? "shimmer" : undefined}>
            {statusLabel}
          </span>
        </Badge>
      </Button>

      <SourceListItemExportAction attempt={attempt} instanceId={instanceId} />
    </div>
  );
}

function SourceListItemExportAction({
  attempt,
  instanceId,
}: {
  attempt: ExportAttempt;
  instanceId: string;
}) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const state = attempt.state;

  if (state.status === "completed") {
    return (
      <Button
        aria-label={getRevealLabel(t)}
        onClick={() => void openFileLocation(state.result.displayPath)}
        size="icon-xs"
        title={getRevealLabel(t)}
        variant="secondary"
      >
        <ExternalLink aria-hidden="true" />
      </Button>
    );
  }

  if (state.status === "queued" || state.status === "rendering") {
    return (
      <Button
        aria-label={t("queue.actions.cancel")}
        onClick={() =>
          void dispatch(cancelExportAttemptRequested({ attemptId: attempt.id, instanceId }))
        }
        size="icon-xs"
        title={t("queue.actions.cancel")}
        variant="destructive"
      >
        <X aria-hidden="true" />
      </Button>
    );
  }

  return null;
}

function SourceListItemActions({ source }: { source: EditingInstance }) {
  const { t } = useTranslation();
  const { hasExports, hasQueuedExports, isRunning } = useAppSelector((state) =>
    selectSourceExportQueueState(state, source.id),
  );

  if (source.sourceAvailability === "deleted") {
    return (
      <>
        <RestoreSource event="click" source={source}>
          <Button size="xs" variant="success">
            <RotateCcw aria-hidden="true" />
            {t("app.actions.restore")}
          </Button>
        </RestoreSource>
        <CloseSource event="click" source={source}>
          <Button size="xs" variant="ghost">
            <X aria-hidden="true" />
            {t("app.actions.closeFile")}
          </Button>
        </CloseSource>
      </>
    );
  }

  if (isRunning) {
    return (
      <CancelSourceExport event="click" source={source}>
        <Button size="xs" variant="destructive">
          <X aria-hidden="true" />
          {t("queue.actions.cancel")}
        </Button>
      </CancelSourceExport>
    );
  }

  if (hasQueuedExports) {
    return (
      <StartSourceExport event="click" source={source}>
        <Button size="xs">
          <Play aria-hidden="true" />
          {t("queue.actions.start")}
        </Button>
      </StartSourceExport>
    );
  }

  if (hasExports) {
    return (
      <>
        <DeleteSource event="click" source={source}>
          <Button size="xs" variant="destructive">
            <Trash2 aria-hidden="true" />
            {t("app.actions.deleteFile")}
          </Button>
        </DeleteSource>
        <CloseSource event="click" source={source}>
          <Button size="xs" variant="ghost">
            <X aria-hidden="true" />
            {t("app.actions.closeFile")}
          </Button>
        </CloseSource>
      </>
    );
  }

  return null;
}

function usePrepareSources() {
  const dispatch = useAppDispatch();

  const instances = useAppSelector(selectImportedEditingInstances);

  useEffect(() => {
    void dispatch(prepareImportedSourceMetadataRequested(instances));
    void dispatch(prepareImportedSourceThumbnailsRequested(instances));
  }, [dispatch, instances]);

  return instances;
}

function getExportQueueItemStatusLabel(t: TFunction, status: ExportAttemptState["status"]): string {
  switch (status) {
    case "completed":
      return t("source.status.completed");
    case "failed":
      return t("source.status.failed");
    case "canceled":
      return t("source.status.canceled");
    case "rendering":
      return t("source.status.rendering");
    case "queued":
      return t("source.status.queued");
  }
}

const SourceListData = createContext<SourceListState | null>(null);

function useSourceListData() {
  const context = React.useContext(SourceListData);
  if (!context) {
    throw new Error("SourceListContent must be used within SourceList");
  }
  return context;
}

export { SourceList, SourceListContent, SourceListSearch, SourceListTabs };

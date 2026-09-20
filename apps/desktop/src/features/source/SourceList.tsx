import type { TFunction } from "i18next";
import {
  Clock3,
  ExternalLink,
  FileVideo2,
  FolderOpen,
  MoreHorizontal,
  Play,
  RotateCcw,
  Scissors,
  Settings2,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import React, { createContext, useEffect } from "react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
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
import { getRevealLabel } from "./lib/source.utils";
import {
  groupSourcesByFolder,
  groupSourcesByImportedTime,
  groupSourcesByUpdatedTime,
  type SourceGroup,
} from "./lib/source-grouping.utils";

interface SourceListProps {
  children?: React.ReactNode;
}

function SourceList({ children }: SourceListProps) {
  const sources = usePrepareSources();

  if (sources.length === 0) return <SourceListEmptyState />;

  return (
    <SourceListData.Provider value={{ sources }}>
      <Tabs className="min-h-0 flex-1" defaultValue="none">
        {children ?? (
          <>
            <SourceListTabs />
            <SourceListTabsContent />
          </>
        )}
      </Tabs>
    </SourceListData.Provider>
  );
}

function SourceListTabs() {
  return (
    <TabsList className="w-full" defaultValue="none">
      <TabsTrigger value="none">None</TabsTrigger>
      <TabsTrigger value="folder">Folder</TabsTrigger>
      <TabsTrigger value="time">Time</TabsTrigger>
      <TabsTrigger value="imported">Imported</TabsTrigger>
    </TabsList>
  );
}

function SourceListTabsContent() {
  const { sources } = useSourceListData();

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
  icon: ReactNode;
}) {
  return (
    <li className="grid gap-2">
      <div className="flex min-w-0 items-center gap-2 px-1 text-sm">
        {icon}
        <span className="truncate" title={group.label}>
          {group.label}
        </span>
      </div>
      <SourceListGrid sources={group.items} />
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
  icon?: ReactNode;
}) {
  return (
    <ul className="flex flex-col gap-3" data-slot={dataSlot}>
      {groups.map((group) => (
        <SourceListGroup
          group={group}
          icon={icon ?? <FolderOpen aria-hidden="true" className="size-3.5 shrink-0" />}
          key={group.key}
        />
      ))}
    </ul>
  );
}

function SourceListGrid({ sources }: { sources: EditingInstance[] }) {
  return (
    <ul className="flex flex-col gap-3" data-slot="imported-sources-grid">
      {sources.map((source) => (
        <SourceListItem key={source.id} source={source} />
      ))}
    </ul>
  );
}

function SourceListTime({ sources }: { sources: EditingInstance[] }) {
  const { i18n, t } = useTranslation();
  const groups = groupSourcesByUpdatedTime(sources, i18n.language, t("common.status.unknown"));

  return (
    <SourceListGroups
      dataSlot="imported-sources-time-groups"
      groups={groups}
      icon={<Clock3 aria-hidden="true" className="size-3.5 shrink-0" />}
    />
  );
}

function SourceListImported({ sources }: { sources: EditingInstance[] }) {
  const { i18n, t } = useTranslation();
  const groups = groupSourcesByImportedTime(sources, i18n.language, t("common.status.unknown"));

  return (
    <SourceListGroups
      dataSlot="imported-sources-import-groups"
      groups={groups}
      icon={<Upload aria-hidden="true" className="size-3.5 shrink-0" />}
    />
  );
}

function SourceListEmptyState() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  return (
    <form
      aria-label={t("source.labels.explorer")}
      className="flex min-h-full w-full items-baseline justify-center px-3 py-8"
      onSubmit={(event) => event.preventDefault()}
    >
      <div className="grid w-full gap-5">
        <div className="grid gap-3">
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

        <div className="flex items-center gap-2">
          <Separator className="flex-1" />
          <span className="text-muted-foreground">{t("common.labels.or")}</span>
          <Separator className="flex-1" />
        </div>

        <div className="grid justify-items-center gap-2 rounded-lg border border-dashed border-border/80 bg-muted/20 px-4 py-6 text-center">
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
      </div>
    </form>
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

function SourceListItem({ source }: { source: EditingInstance }) {
  return (
    <li className="flex w-full flex-col">
      <SourceListItemCard source={source} />
      <SourceListItemExtra source={source} />
    </li>
  );
}

function SourceListItemCard({ source }: { source: EditingInstance }) {
  const { t } = useTranslation();

  return (
    <SourceCard className="z-1 flex flex-row gap-2 p-2" source={source}>
      <SourceCardThumbnail className="w-6/11 shrink-0 rounded-md shadow">
        <SourceCardStatusBadge className="absolute top-2 left-2" />
      </SourceCardThumbnail>

      <div className="relative flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex min-w-0 flex-col gap-1" data-slot="card-header">
          <SourceCardTitle className="line-clamp-2 wrap-break-word whitespace-normal" />
          <SourceCardDescription className="line-clamp-2 wrap-anywhere whitespace-normal" />
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

const SourceListData = createContext<{ sources: EditingInstance[] } | null>(null);

function useSourceListData() {
  const context = React.useContext(SourceListData);
  if (!context) {
    throw new Error("SourceListTabsContent must be used within SourceList");
  }
  return context;
}

export { SourceList, SourceListTabs, SourceListTabsContent };

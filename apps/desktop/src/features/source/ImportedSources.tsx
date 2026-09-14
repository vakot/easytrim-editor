import type { TFunction } from "i18next";
import { ChevronRight, FileVideo2, FolderOpen, Upload } from "lucide-react";
import { type ReactNode, useDeferredValue, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SearchBar } from "@/components/ui/search-bar";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  selectActiveInstanceId,
  selectEditingInstances,
} from "@/app/store/slices/editing-instances-slice";
import { selectPreview } from "@/app/store/slices/preview-slice";
import { selectSourceStatus } from "@/app/store/slices/source-slice";
import {
  chooseSourceRequested,
  closeEditingInstancesRequested,
  navigateToEditingInstance,
  restoreSourceFileRequested,
} from "@/app/store/thunks/source-media-thunks";
import type { EditingInstance } from "@/domain/editing-instance";
import { normalizeSearchValue } from "@/lib/search.utils";
import { openFileLocation } from "@/lib/tauri/media";

import { DeleteSourceDialog } from "./components/DeleteSourceDialog";
import {
  SourceCard,
  type SourceCardLabels,
  type SourceCardStatus,
  type SourceCardVariant,
} from "./SourceCard";

export function ImportedSources({ activityFeed }: { activityFeed?: ReactNode }) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const instances = useAppSelector(selectEditingInstances);
  const activeInstanceId = useAppSelector(selectActiveInstanceId);
  const sourceStatus = useAppSelector(selectSourceStatus);
  const preview = useAppSelector(selectPreview);
  const [searchQuery, setSearchQuery] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const filteredInstances = useMemo(() => {
    const query = normalizeSearchValue(deferredSearchQuery);
    if (!query) return instances;

    return instances.filter((instance) => {
      const source = instance.snapshot.source;
      return (
        normalizeSearchValue(source.displayName).includes(query) ||
        normalizeSearchValue(source.sourcePath).includes(query)
      );
    });
  }, [deferredSearchQuery, instances]);

  const labels: SourceCardLabels = {
    actions: t("source.actions.sourceActions"),
    active: t("source.labels.active"),
    close: t("source.actions.close"),
    deleteSource: t("source.actions.deleteSource"),
    imported: t("source.labels.imported"),
    open: t("app.actions.open"),
    previewUnavailable: t("source.messages.previewUnavailable"),
    reveal: t("source.actions.reveal"),
    restore: t("app.actions.restore"),
    restoreSource: t("source.actions.restoreSource"),
  };

  const pendingDeleteInstance = pendingDeleteId
    ? instances.find((instance) => instance.id === pendingDeleteId)
    : undefined;

  return (
    <aside
      aria-label={t("source.labels.importedSources")}
      className="@container relative flex size-full min-h-0 flex-col pt-3"
    >
      <h3
        className="mx-3 mb-3 font-heading text-xs font-bold tracking-[0.16em] text-primary uppercase"
        id="source-panel-title"
      >
        {t("source.labels.importedSources")}
      </h3>

      <SearchBar
        aria-label={t("common.labels.search")}
        className="mx-3 mb-2"
        onValueChange={setSearchQuery}
        placeholder={t("source.messages.searchPlaceholder")}
        value={searchQuery}
      />

      <ScrollArea className="min-h-0 flex-1">
        {instances.length === 0 ? (
          <ImportedSourcesEmptyState />
        ) : filteredInstances.length === 0 ? (
          <p className="px-3 py-8 text-center text-xs text-muted-foreground">
            {t("source.messages.noSearchResults")}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2 px-3 pt-1 pb-3" data-slot="imported-sources-grid">
            {filteredInstances.map((instance) => {
              const cardStatus = getSourceCardStatus(
                instance,
                instance.id === activeInstanceId,
                sourceStatus,
              );

              const cardVariant = getSourceCardVariant(cardStatus);
              const showRestore = instance.sourceAvailability === "deleted";
              const previewUrl =
                instance.id === activeInstanceId && preview.status === "ready"
                  ? preview.value.url
                  : undefined;

              return (
                <SourceCard
                  active={instance.id === activeInstanceId}
                  displayName={instance.snapshot.source.displayName}
                  id={instance.id}
                  key={instance.id}
                  labels={labels}
                  onClose={() => void dispatch(closeEditingInstancesRequested([instance.id]))}
                  onDelete={() => setPendingDeleteId(instance.id)}
                  onOpen={() => void dispatch(navigateToEditingInstance(instance.id))}
                  onRestore={() =>
                    void dispatch(
                      restoreSourceFileRequested({
                        itemId: instance.id,
                        sourcePath: instance.snapshot.source.sourcePath,
                      }),
                    )
                  }
                  onReveal={() => void openFileLocation(instance.snapshot.source.sourcePath)}
                  previewUrl={previewUrl}
                  showRestore={showRestore}
                  sourcePath={instance.snapshot.source.sourcePath}
                  status={cardStatus}
                  statusLabel={getSourceCardStatusLabel(t, cardStatus)}
                  variant={cardVariant}
                />
              );
            })}
          </div>
        )}
      </ScrollArea>

      {activityFeed ? (
        <Collapsible className="shrink-0 border-t border-foreground/10 p-1" defaultOpen={false}>
          <CollapsibleTrigger asChild>
            <Button
              className="group w-full justify-baseline px-2 text-secondary-foreground"
              size="sm"
              variant="ghost"
            >
              <ChevronRight className="shrink-0 transition-transform group-data-[state=open]:rotate-90" />
              {t("app.labels.activityFeed")}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="max-h-64 min-h-0">
            <ScrollArea className="h-64 px-2 before:top-2">{activityFeed}</ScrollArea>
          </CollapsibleContent>
        </Collapsible>
      ) : null}

      {pendingDeleteInstance ? (
        <DeleteSourceDialog
          onOpenChange={(open) => {
            if (!open) setPendingDeleteId(null);
          }}
          open
          sourceId={pendingDeleteInstance.id}
        >
          <span aria-hidden="true" />
        </DeleteSourceDialog>
      ) : null}
    </aside>
  );
}

function ImportedSourcesEmptyState() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  return (
    <div className="grid gap-4 px-3 py-8 text-center">
      <div className="grid justify-items-center gap-2">
        <span className="grid size-10 place-items-center rounded-full bg-primary/12 text-primary">
          <Upload aria-hidden="true" className="size-5" />
        </span>
        <strong className="text-sm">{t("source.messages.noImportedSources")}</strong>
        <span className="text-xs text-muted-foreground">
          {t("source.messages.dropDescription")}
        </span>
      </div>
      <div className="grid gap-2">
        <Button
          onClick={() =>
            void dispatch(chooseSourceRequested({ id: "sources.open-file", type: "button" }))
          }
          type="button"
        >
          <FileVideo2 aria-hidden="true" />
          {t("app.actions.openFile")}
        </Button>
        <Button
          onClick={() =>
            void dispatch(
              chooseSourceRequested({ id: "sources.open-folder", type: "button" }, "folders"),
            )
          }
          type="button"
          variant="outline"
        >
          <FolderOpen aria-hidden="true" />
          {t("app.actions.openFolder")}
        </Button>
      </div>
    </div>
  );
}

function getSourceCardStatus(
  instance: EditingInstance,
  active: boolean,
  sourceStatus: ReturnType<typeof selectSourceStatus>,
): SourceCardStatus {
  if (instance.sourceAvailability === "deleted") return "deleted";
  if (instance.sourceAvailability === "missing") return "missing";

  const latestAttempt = instance.exportAttempts.at(-1)?.state.status;
  if (latestAttempt === "queued" || latestAttempt === "rendering") return latestAttempt;
  if (latestAttempt === "completed") return "completed";
  if (latestAttempt === "failed") return "failed";
  if (latestAttempt === "canceled") return "canceled";
  if (active && sourceStatus === "failed") return "failed";
  if (active && sourceStatus === "loading-source") return "loading";
  return "ready";
}

function getSourceCardVariant(status: SourceCardStatus): SourceCardVariant {
  switch (status) {
    case "canceled":
    case "deleted":
    case "failed":
      return "destructive";
    case "completed":
    case "ready":
      return "success";
    case "loading":
    case "missing":
    case "queued":
    case "rendering":
      return "warning";
  }
}

function getSourceCardStatusLabel(t: TFunction, status: SourceCardStatus): string {
  switch (status) {
    case "canceled":
      return t("source.status.canceled");
    case "completed":
      return t("source.status.completed");
    case "deleted":
      return t("source.status.deleted");
    case "failed":
      return t("source.status.failed");
    case "loading":
      return t("source.status.loading");
    case "missing":
      return t("source.status.missing");
    case "queued":
      return t("source.status.queued");
    case "ready":
      return t("source.status.ready");
    case "rendering":
      return t("source.status.rendering");
  }
}

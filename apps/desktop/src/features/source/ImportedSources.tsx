import { FileVideo2, FolderOpen, MoreHorizontal, Trash2, Upload, X } from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuIcon,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SearchBar } from "@/components/ui/search-bar";
import { Separator } from "@/components/ui/separator";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  selectActiveInstanceId,
  selectEditingInstances,
} from "@/app/store/slices/editing-instances-slice";
import { selectImportedSourcePreviews } from "@/app/store/slices/preview-slice";
import {
  chooseSourceRequested,
  closeEditingInstancesRequested,
  prepareImportedSourcePreviewsRequested,
} from "@/app/store/thunks/source-media-thunks";
import type { EditingInstance } from "@/domain/editing-instance";
import { normalizeSourceKey } from "@/domain/source";
import { normalizeSearchValue } from "@/lib/search.utils";

import { DeleteSourceDialog, DeleteSourceDialogTrigger } from "./components/DeleteSourceDialog";
import { SourceFolderSection } from "./components/SourceFolderSection";
import { SourceSelectionProvider } from "./components/SourceSelectionProvider";
import { getSourceFolderPath } from "./lib/media-formatters.utils";

export function ImportedSources() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const activeInstanceId = useAppSelector(selectActiveInstanceId);
  const instances = useAppSelector(selectEditingInstances);
  const importedPreviews = useAppSelector(selectImportedSourcePreviews);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSourceIds, setSelectedSourceIds] = useState<Set<string>>(
    () => new Set(activeInstanceId ? [activeInstanceId] : []),
  );

  const deferredSearchQuery = useDeferredValue(searchQuery);

  const effectiveSelectedSourceIds = useMemo(() => {
    if (!activeInstanceId || !instances.some((instance) => instance.id === activeInstanceId)) {
      return selectedSourceIds;
    }
    if (selectedSourceIds.has(activeInstanceId)) return selectedSourceIds;

    return new Set(selectedSourceIds).add(activeInstanceId);
  }, [activeInstanceId, instances, selectedSourceIds]);

  useEffect(() => {
    const instancesWithoutPreview = instances.filter(
      (instance) =>
        instance.sourceAvailability === "available" && importedPreviews[instance.id] === undefined,
    );

    if (instancesWithoutPreview.length === 0) return;

    void dispatch(prepareImportedSourcePreviewsRequested(instancesWithoutPreview));
  }, [dispatch, importedPreviews, instances]);

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

  const sourceFolders = useMemo(() => groupSourcesByFolder(instances), [instances]);
  const visibleSourceFolders = useMemo(() => {
    const visibleSourceIds = new Set(filteredInstances.map((instance) => instance.id));

    return sourceFolders
      .map((folder) => ({
        ...folder,
        sources: folder.sources.filter((source) => visibleSourceIds.has(source.id)),
      }))
      .filter((folder) => folder.sources.length > 0);
  }, [filteredInstances, sourceFolders]);

  const visibleSourceIds = useMemo(
    () => visibleSourceFolders.flatMap((folder) => folder.sources.map((instance) => instance.id)),
    [visibleSourceFolders],
  );

  const initialAnchorId = activeInstanceId ?? visibleSourceIds[0] ?? null;

  if (instances.length === 0) return <ImportedSourcesEmptyState />;

  const selectedInstances = instances.filter((instance) =>
    effectiveSelectedSourceIds.has(instance.id),
  );

  const selectedIds = selectedInstances.map((instance) => instance.id);

  return (
    <>
      <div className="mx-3 mb-2 flex items-center gap-2">
        <SearchBar
          aria-label={t("common.labels.search")}
          className="min-w-0 flex-1"
          onValueChange={setSearchQuery}
          placeholder={t("source.messages.searchPlaceholder")}
          value={searchQuery}
        />
        {selectedIds.length > 1 ? (
          <SourceSelectionActions
            onClearSelection={() =>
              setSelectedSourceIds(activeInstanceId ? new Set([activeInstanceId]) : new Set())
            }
            sourceIds={selectedIds}
          />
        ) : null}
      </div>

      <ScrollArea className="min-h-0 flex-1">
        {visibleSourceFolders.length === 0 ? (
          <p className="px-3 py-8 text-center text-xs text-muted-foreground">
            {t("source.messages.noSearchResults")}
          </p>
        ) : (
          <SourceSelectionProvider
            activeSourceId={activeInstanceId}
            initialAnchorId={initialAnchorId}
            onSelectedSourceIdsChange={setSelectedSourceIds}
            selectedSourceIds={effectiveSelectedSourceIds}
            sourceIds={visibleSourceIds}
          >
            <div className="grid gap-3 pt-1 pb-3" data-slot="imported-sources-grid">
              {visibleSourceFolders.map((folder) => (
                <SourceFolderSection
                  folderPath={folder.path}
                  key={folder.id}
                  searchQuery={deferredSearchQuery}
                  sourceIds={folder.sourceIds}
                  sources={folder.sources}
                />
              ))}
            </div>
          </SourceSelectionProvider>
        )}
      </ScrollArea>
    </>
  );
}

interface ImportedSourceFolder {
  id: string;
  path: string;
  sourceIds: string[];
  sources: EditingInstance[];
}

const sourceFolderCollator = new Intl.Collator(undefined, { sensitivity: "base" });

function groupSourcesByFolder(instances: readonly EditingInstance[]): ImportedSourceFolder[] {
  const foldersByKey = new Map<string, ImportedSourceFolder>();

  for (const source of instances) {
    const path = getSourceFolderPath(source.snapshot.source.sourcePath);
    const key = normalizeSourceKey(path);
    const folder = foldersByKey.get(key);

    if (folder) {
      folder.sourceIds.push(source.id);
      folder.sources.push(source);
      continue;
    }

    foldersByKey.set(key, {
      id: `source-folder:${key}`,
      path,
      sourceIds: [source.id],
      sources: [source],
    });
  }

  return [...foldersByKey.values()].sort((left, right) =>
    sourceFolderCollator.compare(left.path, right.path),
  );
}

function SourceSelectionActions({
  onClearSelection,
  sourceIds,
}: {
  onClearSelection: () => void;
  sourceIds: string[];
}) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  return (
    <DeleteSourceDialog
      onOpenChange={(open) => {
        if (!open) onClearSelection();
      }}
      sourceIds={sourceIds}
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label={`${t("source.actions.sourceActions")}: ${sourceIds.length}`}
            size="icon-sm"
            variant="outline"
          >
            <MoreHorizontal aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            inset
            onSelect={() => {
              void dispatch(closeEditingInstancesRequested(sourceIds));
              onClearSelection();
            }}
          >
            <DropdownMenuIcon>
              <X aria-hidden="true" />
            </DropdownMenuIcon>
            {t("app.actions.closeFile")}
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DeleteSourceDialogTrigger asChild>
            <DropdownMenuItem
              inset
              onSelect={(event) => event.preventDefault()}
              variant="destructive"
            >
              <DropdownMenuIcon>
                <Trash2 aria-hidden="true" />
              </DropdownMenuIcon>
              {t("app.actions.deleteFile")}
            </DropdownMenuItem>
          </DeleteSourceDialogTrigger>
        </DropdownMenuContent>
      </DropdownMenu>
    </DeleteSourceDialog>
  );
}

function ImportedSourcesEmptyState() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  return (
    <form
      aria-label={t("source.labels.explorer")}
      className="flex size-full items-start justify-center px-3 py-8"
      onSubmit={(event) => event.preventDefault()}
    >
      <div className="grid w-full gap-5">
        <div className="grid gap-3">
          <SourceExplorerAction
            description={t("source.messages.openFileDescription")}
            icon={<FileVideo2 aria-hidden="true" />}
            keys={["Ctrl", "O"]}
            label={t("app.actions.openFile")}
            onClick={() =>
              void dispatch(chooseSourceRequested({ id: "explorer.open-file", type: "button" }))
            }
          />
          <SourceExplorerAction
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
          <span className="text-muted-foreground">or</span>
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

function SourceExplorerAction({
  description,
  icon,
  keys,
  label,
  onClick,
}: {
  description: string;
  icon: React.ReactNode;
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

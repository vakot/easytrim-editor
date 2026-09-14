import { FileVideo2, FolderOpen, Upload } from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SearchBar } from "@/components/ui/search-bar";
import { Separator } from "@/components/ui/separator";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import { selectEditingInstances } from "@/app/store/slices/editing-instances-slice";
import { selectImportedSourcePreviews } from "@/app/store/slices/preview-slice";
import {
  chooseSourceRequested,
  prepareImportedSourcePreviewsRequested,
} from "@/app/store/thunks/source-media-thunks";
import { normalizeSearchValue } from "@/lib/search.utils";

import { SourceCard } from "./components/SourceCard";

export function ImportedSources() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const instances = useAppSelector(selectEditingInstances);
  const importedPreviews = useAppSelector(selectImportedSourcePreviews);
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);

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

  if (instances.length === 0) return <ImportedSourcesEmptyState />;

  return (
    <>
      <SearchBar
        aria-label={t("common.labels.search")}
        className="mx-3 mb-2"
        onValueChange={setSearchQuery}
        placeholder={t("source.messages.searchPlaceholder")}
        value={searchQuery}
      />

      <ScrollArea className="min-h-0 flex-1">
        {filteredInstances.length === 0 ? (
          <p className="px-3 py-8 text-center text-xs text-muted-foreground">
            {t("source.messages.noSearchResults")}
          </p>
        ) : (
          <div
            className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,16rem),1fr))] gap-2 px-3 pt-1 pb-3"
            data-slot="imported-sources-grid"
          >
            {filteredInstances.map((instance) => (
              <SourceCard key={instance.id} source={instance} />
            ))}
          </div>
        )}
      </ScrollArea>
    </>
  );
}

function ImportedSourcesEmptyState() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  return (
    <form
      aria-label={t("source.labels.explorer")}
      className="flex min-h-full w-full items-center justify-center px-3 py-8"
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

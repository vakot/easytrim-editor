import { MoreHorizontal } from "lucide-react";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import { selectImportedEditingInstances } from "@/app/store/slices/editing-instances-slice";
import { selectImportedSourceThumbnails } from "@/app/store/slices/preview-slice";
import { prepareImportedSourceThumbnailsRequested } from "@/app/store/thunks/source-media-thunks";
import type { EditingInstance } from "@/domain/editing-instance";

import {
  SourceCard,
  SourceCardActions,
  SourceCardDescription,
  SourceCardDetails,
  SourceCardMetadata,
  SourceCardThumbnail,
  SourceCardTitle,
} from "./components/SourceCard";

function SourceList() {
  const sources = usePrepareSources();

  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="flex flex-col gap-2 p-3" data-slot="imported-sources-grid">
        {sources.map((source) => (
          <SourceListCard source={source} />
        ))}
      </div>
    </ScrollArea>
  );
}

function SourceListCard({ source }: { source: EditingInstance }) {
  const { t } = useTranslation();

  return (
    <SourceCard className="flex flex-row gap-2 p-3" source={source}>
      <SourceCardThumbnail className="w-6/11 shrink-0 rounded-md" />

      {/* TODO: take all space available after thumbnail */}
      <div className="relative flex w-full flex-col gap-3">
        <div className="flex flex-col gap-1" data-slot="card-header">
          {/* TODO: make wrappable */}
          <SourceCardTitle className="wrap-normal" />
          {/* TODO: make wrappable */}
          <SourceCardDescription />
        </div>
        <SourceCardMetadata />

        <SourceCardActions className="absolute right-2 bottom-2">
          <Button
            aria-label={`${t("source.actions.sourceActions")}: ${source.snapshot.source.displayName}`}
            size="icon-sm"
            variant="ghost"
          >
            <MoreHorizontal aria-hidden="true" />
          </Button>
        </SourceCardActions>
      </div>
    </SourceCard>
  );
}

function usePrepareSources() {
  const dispatch = useAppDispatch();

  const instances = useAppSelector(selectImportedEditingInstances);
  const importedThumbnails = useAppSelector(selectImportedSourceThumbnails);
  const thumbnailRequestIds = useRef(new Set<string>());

  useEffect(() => {
    const instancesWithoutThumbnail = instances.filter(
      (instance) =>
        instance.sourceAvailability === "available" &&
        importedThumbnails[instance.id] === undefined &&
        !thumbnailRequestIds.current.has(instance.id),
    );

    if (instancesWithoutThumbnail.length === 0) return;

    for (const instance of instancesWithoutThumbnail) {
      thumbnailRequestIds.current.add(instance.id);
    }

    void dispatch(prepareImportedSourceThumbnailsRequested(instancesWithoutThumbnail));
  }, [dispatch, importedThumbnails, instances]);

  return instances;
}

export { SourceList };

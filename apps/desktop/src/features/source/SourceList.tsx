import { MoreHorizontal, Scissors, Settings2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  selectExportQueue,
  selectImportedEditingInstances,
} from "@/app/store/slices/editing-instances-slice";
import { selectImportedSourceThumbnails } from "@/app/store/slices/preview-slice";
import { prepareImportedSourceThumbnailsRequested } from "@/app/store/thunks/source-media-thunks";
import type { EditingInstance, ExportAttempt } from "@/domain/editing-instance";

import {
  SourceCard,
  SourceCardActions,
  SourceCardDescription,
  SourceCardMetadata,
  SourceCardThumbnail,
  SourceCardTitle,
} from "./components/SourceCard";

function SourceList() {
  const sources = usePrepareSources();

  return (
    <ScrollArea className="min-h-0 flex-1 pb-2">
      <ul className="flex flex-col gap-3 px-3 py-1" data-slot="imported-sources-grid">
        {sources.map((source) => (
          <SourceListItem key={source.id} source={source} />
        ))}
      </ul>
    </ScrollArea>
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
    <SourceCard className="z-1 flex flex-row gap-2 p-2 hover:bg-card-foreground/10" source={source}>
      <SourceCardThumbnail className="w-6/11 shrink-0 rounded-md shadow" />

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

const sourceListItemExtraClassName = "border-t bg-muted/50 p-1 min-h-8";

type PendingInstance = {
  attempt: ExportAttempt;
  instance: EditingInstance;
};

interface SourceListItemExtraItemProps {
  pending: PendingInstance[];
}

function SourceListItemExtra({ source }: { source: EditingInstance }) {
  // TODO: load pending only for specific source
  const { pending } = useAppSelector(selectExportQueue);

  if (pending.length === 0) return null;

  return (
    <div className="w-full px-3">
      {/* TODO: last-child rounded-b */}
      {/* TODO: remove top ring from first child */}
      <ul className="flex flex-col ring-1 ring-foreground/10">
        <SourceListItemExports pending={pending} />
        <SourceListItemActions pending={pending} />
      </ul>
    </div>
  );
}

function SourceListItemExports({ pending }: SourceListItemExtraItemProps) {
  return (
    <li>
      <ul>
        {pending.map(({ attempt, instance }) => (
          <SourceListItemExport attempt={attempt} instance={instance} key={instance.id} />
        ))}
      </ul>
    </li>
  );
}

function SourceListItemExport({ attempt, instance }: PendingInstance) {
  return (
    <li className={sourceListItemExtraClassName}>
      <Button className="w-full justify-between" size="xs" variant="ghost">
        <div className="flex items-center gap-2">
          {/* TODO: show icon when fast-cut */}
          <Scissors aria-hidden="true" />
          {/* TODO: show icon when optimized export */}
          <Settings2 aria-hidden="true" />
          {/* TODO: show exporting filename */}
          <span className="truncate text-xs text-muted-foreground">New cool file.mp4</span>
        </div>
        {/* TODO: show correct status */}
        <Badge variant="outline">
          <span className="shimmer">rendering</span>
        </Badge>
      </Button>
    </li>
  );
}

function SourceListItemActions({ pending }: SourceListItemExtraItemProps) {
  // TODO: early exit if already exporting
  // TODO: show "restore" if deleted
  // TODO: show "delete" if queue ended and no more items

  return (
    <li className={sourceListItemExtraClassName}>
      <Button size="xs">Start</Button>
    </li>
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

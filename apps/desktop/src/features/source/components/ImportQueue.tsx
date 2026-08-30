import { ChevronLeft, ChevronRight, Trash, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { useTimeline } from "@/app/hooks/useTimeline";
import type { importQueueItem } from "@/app/store/slices/export-slice";
import { editorSnapshotTrimStart } from "@/domain/editor-snapshot";
import { cn } from "@/lib/class-names.utils";

import { useImportQueue } from "../hooks/useImportQueue";

export function ImportQueue() {
  const { t } = useTranslation();

  const { activeIndex, activeItem, items, next, prev } = useImportQueue();

  return (
    <section aria-labelledby="import-queue-title">
      <h2 className="sr-only" id="import-queue-title">
        {t("queue.labels.import")}
      </h2>

      <div className="sticky top-0 grid grid-cols-2 gap-2 bg-card pb-2">
        <Button disabled={activeIndex <= 0} onClick={prev} size="sm" variant="outline">
          <ChevronLeft aria-hidden="true" />
          {t("queue.actions.previous")}
        </Button>
        <Button
          disabled={activeIndex < 0 || activeIndex >= items.length - 1}
          onClick={next}
          size="sm"
          variant="outline"
        >
          {t("queue.actions.next")}
          <ChevronRight aria-hidden="true" />
        </Button>
      </div>

      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
          {t("common.status.empty")}
        </p>
      ) : (
        <div aria-live="polite" className="grid gap-2 pb-2" role="status">
          {items.map((item) => (
            <ImportQueueItem active={item.id === activeItem?.id} item={item} key={item.id} />
          ))}
        </div>
      )}
    </section>
  );
}

function ImportQueueItem({ active, item }: { active: boolean; item: importQueueItem }) {
  const { t } = useTranslation();

  const timeline = useTimeline();
  const { open, remove } = useImportQueue();
  const sourcePath = formatSourcePath(item.snapshot.source.sourcePath);

  async function restoreItem() {
    open(item.id);
    timeline.onSeek(editorSnapshotTrimStart(item.snapshot.trim));
  }

  return (
    <Card
      aria-label={t("queue.accessibility.restoreItem", {
        filename: item.snapshot.source.displayName,
      })}
      className={cn(
        "border-l-4 transition-colors ring-inset hover:bg-muted/60",
        active && "border-l-primary",
      )}
      onClick={() => void restoreItem()}
      size="sm"
    >
      <CardHeader>
        <CardTitle className="truncate">{item.snapshot.source.displayName}</CardTitle>
        <CardDescription className="truncate">{sourcePath}</CardDescription>
        <CardAction>
          <Button
            aria-label={t("queue.accessibility.removeImportItem", {
              filename: item.snapshot.source.displayName,
            })}
            onClick={(event) => {
              event.stopPropagation();
              remove(item.id);
            }}
            size="icon"
            type="button"
            variant="destructive"
          >
            <X aria-hidden="true" />
          </Button>
        </CardAction>
      </CardHeader>
    </Card>
  );
}

function formatSourcePath(sourcePath: string): string {
  const extendedPathPrefix = "\\\\?\\";
  return sourcePath.startsWith(extendedPathPrefix)
    ? sourcePath.slice(extendedPathPrefix.length)
    : sourcePath;
}

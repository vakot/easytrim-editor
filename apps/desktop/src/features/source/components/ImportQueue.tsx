import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

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
        <div aria-live="polite" className="grid gap-2" role="status">
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
  const { open } = useImportQueue();
  const sourcePath = formatSourcePath(item.snapshot.source.sourcePath);

  async function restoreItem() {
    open(item.id);
    timeline.onSeek(editorSnapshotTrimStart(item.snapshot.trim));
  }

  return (
    <Card
      className={cn(
        "flex-row items-center gap-2 border-l-4 p-0 transition-colors ring-inset hover:bg-muted/60",
        active && "border-accent-foreground",
      )}
    >
      <button
        aria-label={t("queue.accessibility.restoreItem", {
          filename: item.snapshot.source.displayName,
        })}
        className="size-full cursor-pointer p-2 text-left"
        onClick={() => void restoreItem()}
        type="button"
      >
        <strong className="truncate">{item.snapshot.source.displayName}</strong>
        <p className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
          <span className="truncate">{sourcePath}</span>
        </p>
      </button>
    </Card>
  );
}

function formatSourcePath(sourcePath: string): string {
  const extendedPathPrefix = "\\\\?\\";
  return sourcePath.startsWith(extendedPathPrefix)
    ? sourcePath.slice(extendedPathPrefix.length)
    : sourcePath;
}

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useAppDispatch, useAppSelector } from "@/app/store/hooks";
import { selectActiveItemId, selectimportQueueItems } from "@/app/store/slices/export-slice";
import { navigateToImportedItem } from "@/app/store/thunks/source-media-thunks";
import { Button } from "@/components/ui/button";

export function ImportedQueue() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const items = useAppSelector(selectimportQueueItems);
  const activeItemId = useAppSelector(selectActiveItemId);
  if (items.length === 0) return null;

  const activeIndex = items.findIndex((item) => item.id === activeItemId);
  const position = activeIndex >= 0 ? activeIndex + 1 : 0;
  const activeItem = activeIndex >= 0 ? items[activeIndex] : undefined;

  return (
    <section className="grid gap-3" aria-labelledby="imported-queue-title">
      <div className="flex items-center justify-between">
        <h2
          id="imported-queue-title"
          className="font-heading text-xs font-bold tracking-[0.16em] text-primary uppercase"
        >
          {t("import.queue.title")}
        </h2>
        <span className="text-xs text-muted-foreground" data-testid="imported-queue-position">
          {position} / {items.length}
        </span>
      </div>
      <p className="truncate text-sm" title={activeItem?.snapshot.source.displayName}>
        {activeItem?.snapshot.source.displayName ?? t("import.queue.noActive")}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={activeIndex <= 0}
          onClick={() => {
            const previous = items[activeIndex - 1];
            if (previous) dispatch(navigateToImportedItem(previous.id));
          }}
        >
          <ChevronLeft aria-hidden="true" />
          {t("import.queue.previous")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={activeIndex < 0 || activeIndex >= items.length - 1}
          onClick={() => {
            const next = items[activeIndex + 1];
            if (next) dispatch(navigateToImportedItem(next.id));
          }}
        >
          {t("import.queue.next")}
          <ChevronRight aria-hidden="true" />
        </Button>
      </div>
    </section>
  );
}

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";

import { useImportQueue } from "../hooks/useImportQueue";

export function ImportQueue() {
  const { t } = useTranslation();

  const { activeIndex, items, next, prev } = useImportQueue();

  return (
    <section className="grid grid-cols-2 gap-2">
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
    </section>
  );
}

import { List } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

function ExportQueueEmpty() {
  const { t } = useTranslation();

  return (
    <section
      aria-label={t("queue.title")}
      className="flex min-h-full items-center justify-center overflow-hidden"
    >
      <Empty className="w-full max-w-md border-0">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <List aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>{t("queue.title")}</EmptyTitle>
          <EmptyDescription>{t("queue.empty.description")}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    </section>
  );
}

export { ExportQueueEmpty };

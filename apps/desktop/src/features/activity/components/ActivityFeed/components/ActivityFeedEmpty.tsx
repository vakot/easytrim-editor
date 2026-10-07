import { History } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

function ActivityFeedEmpty() {
  const { t } = useTranslation();

  return (
    <section
      aria-label={t("layout.activityFeed")}
      className="flex items-center justify-center overflow-hidden"
    >
      <Empty className="w-full max-w-md">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <History aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>{t("activity.empty.title")}</EmptyTitle>
          <EmptyDescription>{t("activity.empty.description")}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    </section>
  );
}

export { ActivityFeedEmpty };

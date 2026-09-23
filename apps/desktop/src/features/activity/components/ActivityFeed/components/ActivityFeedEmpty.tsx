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
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <History aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>{t("activity.labels.emptyTitle")}</EmptyTitle>
        <EmptyDescription>{t("activity.labels.emptyDescription")}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

export { ActivityFeedEmpty };

import { useTranslation } from "react-i18next";

function ActivityFeedEmptyState() {
  const { t } = useTranslation();

  return (
    <p className="mx-3 rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
      {t("app.messages.activityEmpty")}
    </p>
  );
}

export { ActivityFeedEmptyState };

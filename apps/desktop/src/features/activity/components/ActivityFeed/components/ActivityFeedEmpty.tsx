import { useTranslation } from "react-i18next";

function ActivityFeedEmpty() {
  const { t } = useTranslation();

  return (
    <p className="rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
      {t("app.messages.activityEmpty")}
    </p>
  );
}

export { ActivityFeedEmpty };

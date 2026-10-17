import { useTranslation } from "react-i18next";

import { Spinner } from "@/components/ui/spinner";

function AchievementsLoading() {
  const { t } = useTranslation();

  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
      <Spinner aria-hidden="true" />
      <span role="status">{t("common.status.loading")}</span>
    </div>
  );
}

export { AchievementsLoading };

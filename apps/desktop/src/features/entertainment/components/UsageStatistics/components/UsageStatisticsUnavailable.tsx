import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";

import { useAppDispatch } from "@/app/store/redux-hooks";
import { loadUsageStatistics } from "@/app/store/thunks/usage-statistics-thunks";

function UsageStatisticsUnavailable() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center text-sm text-muted-foreground">
      <p role="alert">{t("statistics.unavailable")}</p>
      <Button
        onClick={() => void dispatch(loadUsageStatistics())}
        size="sm"
        type="button"
        variant="outline"
      >
        {t("common.actions.retry")}
      </Button>
    </div>
  );
}

export { UsageStatisticsUnavailable };

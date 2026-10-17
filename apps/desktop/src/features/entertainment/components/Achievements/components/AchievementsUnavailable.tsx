import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";

import { useAppDispatch } from "@/app/store/redux-hooks";
import { loadAchievementRecords } from "@/app/store/thunks/achievement-thunks";

function AchievementsUnavailable() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center text-sm text-muted-foreground">
      <p role="alert">{t("achievements.unavailable")}</p>
      <Button
        onClick={() => void dispatch(loadAchievementRecords())}
        size="sm"
        type="button"
        variant="outline"
      >
        {t("common.actions.retry")}
      </Button>
    </div>
  );
}

export { AchievementsUnavailable };

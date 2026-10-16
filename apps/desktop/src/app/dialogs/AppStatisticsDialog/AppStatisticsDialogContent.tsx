import { ShieldCheck } from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import type { DialogScope } from "@/components/ui/dialog";
import {
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  selectUsageStatistics,
  selectUsageStatisticsStatus,
} from "@/app/store/slices/usage-statistics-slice";
import { loadUsageStatistics } from "@/app/store/thunks/usage-statistics-thunks";
import { UsageStatisticsDashboard } from "@/features/entertainment";

function AppStatisticsDialogContent({ __scopeDialog }: { __scopeDialog?: DialogScope }) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const hasStatistics = useAppSelector((state) => selectUsageStatistics(state) !== null);
  const status = useAppSelector(selectUsageStatisticsStatus);

  useEffect(() => {
    void dispatch(loadUsageStatistics());
  }, [dispatch]);

  return (
    <>
      <DialogHeader className="-mx-4 border-b px-4 pb-4">
        <DialogTitle __scopeDialog={__scopeDialog}>{t("statistics.title")}</DialogTitle>
        <DialogDescription __scopeDialog={__scopeDialog}>
          {t("statistics.description")}
        </DialogDescription>
      </DialogHeader>

      <ScrollArea className="-mx-4 min-h-0 px-4" fadeColor="var(--popover)">
        {hasStatistics ? (
          <UsageStatisticsDashboard />
        ) : status === "failed" ? (
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
        ) : (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Spinner aria-hidden="true" />
            <span role="status">{t("common.status.loading")}</span>
          </div>
        )}
      </ScrollArea>

      <DialogFooter __scopeDialog={__scopeDialog} className="items-center sm:justify-between">
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck aria-hidden="true" className="size-4 shrink-0" />
          {t("statistics.privacy")}
        </p>
        <DialogClose __scopeDialog={__scopeDialog} asChild>
          <Button type="button">{t("common.actions.close")}</Button>
        </DialogClose>
      </DialogFooter>
    </>
  );
}

export { AppStatisticsDialogContent };

import { ShieldCheck } from "lucide-react";
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

import {
  UsageStatistics,
  UsageStatisticsContent,
  UsageStatisticsDashboard,
} from "@/features/entertainment";

function AppStatisticsDialogContent({ __scopeDialog }: { __scopeDialog?: DialogScope }) {
  const { t } = useTranslation();

  return (
    <UsageStatistics>
      <DialogHeader className="-mx-4 border-b px-4 pb-4">
        <DialogTitle __scopeDialog={__scopeDialog}>{t("statistics.title")}</DialogTitle>
        <DialogDescription __scopeDialog={__scopeDialog}>
          {t("statistics.description")}
        </DialogDescription>
      </DialogHeader>

      <UsageStatisticsContent className="-mx-2 px-2" fadeColor="var(--popover)">
        <UsageStatisticsDashboard />
      </UsageStatisticsContent>

      <DialogFooter __scopeDialog={__scopeDialog} className="items-center sm:justify-between">
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck aria-hidden="true" className="size-4 shrink-0" />
          {t("statistics.privacy")}
        </p>
        <DialogClose __scopeDialog={__scopeDialog} asChild>
          <Button type="button">{t("common.actions.close")}</Button>
        </DialogClose>
      </DialogFooter>
    </UsageStatistics>
  );
}

export { AppStatisticsDialogContent };

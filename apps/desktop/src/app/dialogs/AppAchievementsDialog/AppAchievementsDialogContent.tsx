import { ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@easytrim-editor/ui/button";

import type { DialogScope } from "@/components/ui/dialog";
import {
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  Achievements,
  AchievementsCollection,
  AchievementsSummary,
} from "@/features/entertainment";

function AppAchievementsDialogContent({ __scopeDialog }: { __scopeDialog?: DialogScope }) {
  const { t } = useTranslation();

  return (
    <Achievements>
      <DialogHeader className="-mx-4 border-b px-4 pb-4">
        <DialogTitle __scopeDialog={__scopeDialog}>{t("achievements.title")}</DialogTitle>
        <DialogDescription __scopeDialog={__scopeDialog}>
          {t("achievements.description")}
        </DialogDescription>
        <AchievementsSummary className="pt-2" />
      </DialogHeader>

      <AchievementsCollection />

      <DialogFooter __scopeDialog={__scopeDialog} className="items-center sm:justify-between">
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck aria-hidden="true" className="size-4 shrink-0" />
          {t("achievements.privacy")}
        </p>
        <DialogClose __scopeDialog={__scopeDialog} asChild>
          <Button type="button">{t("common.actions.close")}</Button>
        </DialogClose>
      </DialogFooter>
    </Achievements>
  );
}

export { AppAchievementsDialogContent };

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

import { WorkspaceHistory } from "@/features/history";

function AppHistoryDialogContent({ __scopeDialog }: { __scopeDialog?: DialogScope }) {
  const { t } = useTranslation();

  return (
    <>
      <DialogHeader className="-mx-4 border-b px-4 pb-4">
        <DialogTitle __scopeDialog={__scopeDialog} autoFocus tabIndex={-1}>
          {t("history.title")}
        </DialogTitle>
        <DialogDescription __scopeDialog={__scopeDialog}>
          {t("history.description")}
        </DialogDescription>
      </DialogHeader>
      <WorkspaceHistory />
      <DialogFooter __scopeDialog={__scopeDialog}>
        <DialogClose __scopeDialog={__scopeDialog} asChild>
          <Button variant="outline">{t("common.actions.close")}</Button>
        </DialogClose>
      </DialogFooter>
    </>
  );
}

export { AppHistoryDialogContent };

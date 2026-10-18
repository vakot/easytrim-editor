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

import { useAppSelector } from "@/app/store/redux-hooks";
import { WorkspaceHistory, WorkspaceHistoryNavigation } from "@/features/history";

function AppHistoryDialogContent({ __scopeDialog }: { __scopeDialog?: DialogScope }) {
  const { t } = useTranslation();

  const operations = useAppSelector((state) => state.workspaceHistory.operations);
  const position = useAppSelector((state) => state.workspaceHistory.position);

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

      <DialogFooter __scopeDialog={__scopeDialog} className="items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <WorkspaceHistoryNavigation />
          <span className="truncate text-muted-foreground">
            {position}/{operations.length}
          </span>
        </div>
        <DialogClose __scopeDialog={__scopeDialog} asChild>
          <Button variant="outline">{t("common.actions.close")}</Button>
        </DialogClose>
      </DialogFooter>
    </>
  );
}

export { AppHistoryDialogContent };

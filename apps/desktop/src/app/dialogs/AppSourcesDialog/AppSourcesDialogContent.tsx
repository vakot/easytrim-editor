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
  SourceList,
  SourceListCloseAll,
  SourceListContent,
  SourceListSearch,
} from "@/features/source/source-list";

function AppSourcesDialogContent({ __scopeDialog }: { __scopeDialog?: DialogScope }) {
  const { t } = useTranslation();

  return (
    <SourceList>
      <DialogHeader className="-mx-4 border-b px-4 pb-4">
        <DialogTitle __scopeDialog={__scopeDialog}>{t("source.title")}</DialogTitle>
        <DialogDescription __scopeDialog={__scopeDialog}>
          {t("source.description")}
        </DialogDescription>
      </DialogHeader>

      <div className="flex min-h-0 flex-1 flex-col pt-3">
        <div className="flex items-center gap-2">
          <SourceListSearch autoFocus />
          <SourceListCloseAll />
        </div>
        <SourceListContent className="-mx-2 px-2" fadeColor="var(--popover)" />
      </div>

      <DialogFooter __scopeDialog={__scopeDialog}>
        <DialogClose __scopeDialog={__scopeDialog} asChild>
          <Button variant="outline">{t("common.actions.close")}</Button>
        </DialogClose>
      </DialogFooter>
    </SourceList>
  );
}

export { AppSourcesDialogContent };

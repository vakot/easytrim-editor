import { useTranslation } from "react-i18next";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  SourceList,
  SourceListCloseAll,
  SourceListContent,
  SourceListSearch,
} from "@/features/source";

interface SourcesWorkspaceDialogProps {
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

function SourcesWorkspaceDialog({ onOpenChange, open }: SourcesWorkspaceDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <SourceList>
        <DialogContent className="h-[min(80dvh,40rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden pb-0 sm:max-w-lg">
          <DialogHeader className="-mx-4 border-b px-4 pb-4">
            <DialogTitle>{t("source.title")}</DialogTitle>
            <DialogDescription className="sr-only">{t("source.description")}</DialogDescription>
          </DialogHeader>

          <div className="flex min-h-0 flex-1 flex-col pt-3">
            <div className="flex items-center gap-2">
              <SourceListSearch />
              <SourceListCloseAll />
            </div>
            <SourceListContent className="-mx-2 px-2" fadeColor="var(--popover)" />
          </div>
        </DialogContent>
      </SourceList>
    </Dialog>
  );
}

export { SourcesWorkspaceDialog };

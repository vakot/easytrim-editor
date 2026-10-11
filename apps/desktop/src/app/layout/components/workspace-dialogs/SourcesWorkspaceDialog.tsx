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
      <DialogContent className="grid max-h-[min(88dvh,56rem)] grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden sm:max-w-4xl">
        <DialogHeader className="border-b pb-3">
          <DialogTitle>{t("source.importedSources")}</DialogTitle>
          <DialogDescription className="sr-only">
            {t("layout.workspaceViewDescription")}
          </DialogDescription>
        </DialogHeader>
        <SourceList>
          <div className="flex min-h-0 flex-1 flex-col pt-3">
            <div className="flex items-center gap-2 pb-3">
              <SourceListSearch />
              <SourceListCloseAll />
            </div>
            <SourceListContent className="min-h-0 flex-1" />
          </div>
        </SourceList>
      </DialogContent>
    </Dialog>
  );
}

export { SourcesWorkspaceDialog };

import { X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { useAppSelector } from "@/app/store/redux-hooks";
import { selectImportedEditingInstanceIds } from "@/app/store/slices/editing-instances-slice";

import { CloseSources } from "../../SourceMenuActions";

function SourceListCloseAll() {
  const { t } = useTranslation();
  const sourceIds = useAppSelector(selectImportedEditingInstanceIds);
  const label = t("source.actions.closeAllSources");

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">
          <CloseSources sourceIds={sourceIds}>
            <Button aria-label={label} size="icon-sm" variant="destructive">
              <X aria-hidden="true" />
            </Button>
          </CloseSources>
        </span>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export { SourceListCloseAll };

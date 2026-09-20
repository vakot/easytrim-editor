import { ExternalLink, RotateCcw, Trash2, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { CardAction } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuIcon,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { cn } from "@/lib/class-names.utils";
import { openFileLocation } from "@/lib/tauri/media";

import { getRevealLabel } from "../../../lib/source.utils";
import { CloseSource, DeleteSource, RestoreSource } from "../../SourceMenuActions";
import { useSourceCardData } from "../hooks/useSourceCardData";

/**
 * @name SourceCardActions
 * @description Builds the dropdown menu for one source card using the shared source menu actions.
 */
function SourceCardActions({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const source = useSourceCardData();
  const [menuOpen, setMenuOpen] = useState(false);
  const { t } = useTranslation();

  const { sourcePath } = source.snapshot.source;
  const showRestore = source.sourceAvailability === "deleted";
  const revealLabel = getRevealLabel(t);

  return (
    <CardAction
      className={cn(className, menuOpen ? "visible" : undefined)}
      onClick={(event) => event.stopPropagation()}
    >
      <DropdownMenu onOpenChange={setMenuOpen}>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>{t("source.actions.sourceActions")}</TooltipContent>
        </Tooltip>

        <DropdownMenuContent align="end">
          <DropdownMenuItem
            disabled={showRestore}
            inset
            onSelect={() => void openFileLocation(sourcePath)}
          >
            <DropdownMenuIcon>
              <ExternalLink aria-hidden="true" />
            </DropdownMenuIcon>
            {revealLabel}
          </DropdownMenuItem>

          <CloseSource source={source}>
            <DropdownMenuItem inset>
              <DropdownMenuIcon>
                <X aria-hidden="true" />
              </DropdownMenuIcon>
              {t("app.actions.closeFile")}
            </DropdownMenuItem>
          </CloseSource>

          <DropdownMenuSeparator />

          {showRestore ? (
            <RestoreSource source={source}>
              <DropdownMenuItem inset variant="success">
                <DropdownMenuIcon>
                  <RotateCcw aria-hidden="true" />
                </DropdownMenuIcon>
                {t("app.actions.restore")}
              </DropdownMenuItem>
            </RestoreSource>
          ) : (
            <DeleteSource source={source}>
              <DropdownMenuItem inset variant="destructive">
                <DropdownMenuIcon>
                  <Trash2 aria-hidden="true" />
                </DropdownMenuIcon>
                {t("app.actions.deleteFile")}
              </DropdownMenuItem>
            </DeleteSource>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </CardAction>
  );
}

export { SourceCardActions };

import { ExternalLink, RotateCcw, Trash2, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { CardAction } from "@easytrim-editor/ui/card";
import { cn } from "@easytrim-editor/ui/class-names";
import { Tooltip, TooltipContent, TooltipTrigger } from "@easytrim-editor/ui/tooltip";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuIcon,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { openFileLocation } from "@/lib/tauri/media";

import { getRevealLabel } from "../../../lib/source.utils";
import { RestoreSource } from "../../RestoreSource";
import { CloseSource, DeleteSource } from "../../SourceMenuActions";
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

  const { sourcePath } = source;
  const showRestore = source.sourceAvailability === "deleted";
  const revealLabel = getRevealLabel(t);

  return (
    <CardAction
      className={cn(className, menuOpen ? "pointer-events-auto visible opacity-100" : undefined)}
      onClick={(event) => event.stopPropagation()}
    >
      <DropdownMenu onOpenChange={setMenuOpen}>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>{t("source.actions.title")}</TooltipContent>
        </Tooltip>

        <DropdownMenuContent align="end">
          <DropdownMenuItem
            disabled={source.sourceAvailability !== "available"}
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
              {t("source.file.closeFile")}
            </DropdownMenuItem>
          </CloseSource>

          <DropdownMenuSeparator />

          {showRestore ? (
            <RestoreSource source={source}>
              <DropdownMenuItem inset variant="success">
                <DropdownMenuIcon>
                  <RotateCcw aria-hidden="true" />
                </DropdownMenuIcon>
                {t("app.workspaceRecovery.restore")}
              </DropdownMenuItem>
            </RestoreSource>
          ) : (
            <DeleteSource source={source}>
              <DropdownMenuItem inset variant="destructive">
                <DropdownMenuIcon>
                  <Trash2 aria-hidden="true" />
                </DropdownMenuIcon>
                {t("source.file.deleteFile")}
              </DropdownMenuItem>
            </DeleteSource>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </CardAction>
  );
}

export { SourceCardActions };

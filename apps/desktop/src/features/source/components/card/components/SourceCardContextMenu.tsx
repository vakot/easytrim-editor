import { ExternalLink, RotateCcw, Trash2, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuIcon,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

import { openFileLocation } from "@/lib/tauri/media";

import { getRevealLabel } from "../../../lib/source.utils";
import { CloseSource, DeleteSource, RestoreSource } from "../../SourceMenuActions";
import { useSourceCardSource } from "../hooks/useSourceCardSource";

/**
 * @name SourceCardContextMenu
 * @description Builds the context menu for one source card, including its file lifecycle actions.
 */
function SourceCardContextMenu({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const source = useSourceCardSource();

  const { sourcePath } = source.snapshot.source;
  const showRestore = source.sourceAvailability === "deleted";
  const revealLabel = getRevealLabel(t);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>

      <ContextMenuContent>
        <ContextMenuItem
          disabled={showRestore}
          inset
          onSelect={() => void openFileLocation(sourcePath)}
        >
          <ContextMenuIcon>
            <ExternalLink aria-hidden="true" />
          </ContextMenuIcon>
          {revealLabel}
        </ContextMenuItem>

        <CloseSource source={source}>
          <ContextMenuItem inset>
            <ContextMenuIcon>
              <X aria-hidden="true" />
            </ContextMenuIcon>
            {t("app.actions.closeFile")}
          </ContextMenuItem>
        </CloseSource>

        <ContextMenuSeparator />

        {showRestore ? (
          <RestoreSource source={source}>
            <ContextMenuItem inset variant="success">
              <ContextMenuIcon>
                <RotateCcw aria-hidden="true" />
              </ContextMenuIcon>
              {t("app.actions.restore")}
            </ContextMenuItem>
          </RestoreSource>
        ) : (
          <DeleteSource source={source}>
            <ContextMenuItem inset variant="destructive">
              <ContextMenuIcon>
                <Trash2 aria-hidden="true" />
              </ContextMenuIcon>
              {t("app.actions.deleteFile")}
            </ContextMenuItem>
          </DeleteSource>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}

export { SourceCardContextMenu };

import {
  ChevronRight,
  ExternalLink,
  Folder,
  FolderOpen,
  MoreHorizontal,
  Trash2,
  X,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuIcon,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { useAppDispatch } from "@/app/store/redux-hooks";
import { closeEditingInstancesRequested } from "@/app/store/thunks/source-media-thunks";
import type { EditingInstance } from "@/domain/editing-instance";
import { openFileLocation } from "@/lib/tauri/media";

import { getRevealLabel } from "../lib/source-tree.utils";

import { DeleteSourceDialog, DeleteSourceDialogTrigger } from "./DeleteSourceDialog";
import { SourceCard } from "./SourceCard";

interface SourceFolderSectionProps {
  folderPath: string;
  searchQuery: string;
  sourceIds: string[];
  sources: EditingInstance[];
}

export function SourceFolderSection({
  folderPath,
  searchQuery,
  sourceIds,
  sources,
}: SourceFolderSectionProps) {
  const [open, setOpen] = useState(true);
  const searchActive = searchQuery.trim().length > 0;

  return (
    <Collapsible onOpenChange={setOpen} open={searchActive || open}>
      <div className="flex min-w-0 items-center gap-1 px-3">
        <CollapsibleTrigger asChild>
          <Button
            aria-label={folderPath}
            className="group min-w-0 flex-1 justify-start"
            size="sm"
            variant="ghost"
          >
            <ChevronRight className="shrink-0 transition-transform group-data-[state=open]:rotate-90" />
            <Folder className="shrink-0 group-data-[state=open]:hidden" />
            <FolderOpen className="hidden shrink-0 group-data-[state=open]:block" />
            <span className="truncate" title={folderPath}>
              {folderPath}
            </span>
            <Badge className="ml-auto" size="xs" variant="ghost">
              {sourceIds.length}
            </Badge>
          </Button>
        </CollapsibleTrigger>

        <SourceFolderActions folderPath={folderPath} sourceIds={sourceIds} />
      </div>

      <CollapsibleContent>
        <div
          className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,16rem),1fr))] gap-2 px-3 pt-1 pb-3"
          data-source-folder={folderPath}
        >
          {sources.map((source) => (
            <SourceCard key={source.id} source={source} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function SourceFolderActions({
  folderPath,
  sourceIds,
}: Omit<SourceFolderSectionProps, "searchQuery" | "sources">) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const revealLabel = getRevealLabel(t);

  return (
    <DeleteSourceDialog sourceIds={sourceIds} target="folder" targetName={folderPath}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label={`${t("source.actions.folderActions")}: ${folderPath}`}
            size="icon-xs"
            variant="ghost"
          >
            <MoreHorizontal aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end">
          <DropdownMenuItem inset onSelect={() => void openFileLocation(folderPath)}>
            <DropdownMenuIcon>
              <ExternalLink aria-hidden="true" />
            </DropdownMenuIcon>
            {revealLabel}
          </DropdownMenuItem>

          <DropdownMenuItem
            inset
            onSelect={() => void dispatch(closeEditingInstancesRequested(sourceIds))}
          >
            <DropdownMenuIcon>
              <X aria-hidden="true" />
            </DropdownMenuIcon>
            {t("source.actions.closeFolder")}
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DeleteSourceDialogTrigger asChild>
            <DropdownMenuItem
              inset
              onSelect={(event) => event.preventDefault()}
              variant="destructive"
            >
              <DropdownMenuIcon>
                <Trash2 aria-hidden="true" />
              </DropdownMenuIcon>
              {t("source.actions.deleteFolder")}
            </DropdownMenuItem>
          </DeleteSourceDialogTrigger>
        </DropdownMenuContent>
      </DropdownMenu>
    </DeleteSourceDialog>
  );
}

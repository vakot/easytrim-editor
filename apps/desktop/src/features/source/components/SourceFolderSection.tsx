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

import type { EditingInstance } from "@/domain/editing-instance";
import { openFileLocation } from "@/lib/tauri/media";

import { getRevealLabel } from "../lib/source.utils";

import { SourceCard } from "./SourceCard";
import { MenuCloseSources, MenuDeleteSources } from "./SourceMenuActions";

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
      <div className="sticky top-0 z-10 flex min-w-0 items-center gap-1 bg-card px-3 py-1">
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

        <SourceFolderActions folderPath={folderPath} sources={sources} />
      </div>

      <CollapsibleContent>
        <div
          className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,16rem),1fr))] gap-2 px-3 py-1"
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
  sources,
}: Pick<SourceFolderSectionProps, "folderPath" | "sources">) {
  const { t } = useTranslation();
  const revealLabel = getRevealLabel(t);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={`${t("source.actions.folderActions")}: ${folderPath}`}
          size="icon-sm"
          variant="secondary"
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

        <MenuCloseSources sources={sources}>
          <DropdownMenuItem inset>
            <DropdownMenuIcon>
              <X aria-hidden="true" />
            </DropdownMenuIcon>
            {t("source.actions.closeFolder")}
          </DropdownMenuItem>
        </MenuCloseSources>

        <DropdownMenuSeparator />

        <MenuDeleteSources sources={sources} target="folder" targetName={folderPath}>
          <DropdownMenuItem inset variant="destructive">
            <DropdownMenuIcon>
              <Trash2 aria-hidden="true" />
            </DropdownMenuIcon>
            {t("source.actions.deleteFolder")}
          </DropdownMenuItem>
        </MenuDeleteSources>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

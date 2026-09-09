import { Children, type PropsWithChildren, useDeferredValue, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SearchBar } from "@/components/ui/search-bar";

import { useAppSelector } from "@/app/store/redux-hooks";
import {
  selectActiveInstanceId,
  selectEditingInstanceTopologyEntries,
} from "@/app/store/slices/editing-instances-slice";

import { SourceDetails } from "./components/SourceDetails";
import { SourceTreeNodes } from "./components/SourceTreeNodes";
import { formatSourcePath } from "./lib/media-formatters.utils";
import {
  filterSourceTreeNodes,
  getPathDirectories,
  getSourceTreeNodes,
  getSourceTreeSiblings,
  type SourceTreeNode,
} from "./lib/source-tree.utils";

export function SourceBreadcrumb() {
  const activeInstanceId = useAppSelector(selectActiveInstanceId);
  const entries = useAppSelector(selectEditingInstanceTopologyEntries);
  const instance = entries.find((entry) => entry.id === activeInstanceId);

  if (!instance) return null;

  const sourcePath = formatSourcePath(instance.sourcePath);
  const directories = getPathDirectories(sourcePath);
  const nodes = getSourceTreeNodes(entries, { compact: false });
  return (
    <Breadcrumb className="min-w-0 px-2 pb-1">
      <BreadcrumbList className="min-w-0 flex-nowrap overflow-hidden text-xs">
        <SourceBreadcrumbList>
          {directories.map((directory) => (
            <SourceBreadcrumbDirectory
              directory={directory}
              key={directory.path}
              nodes={nodes}
              value={instance.id}
            />
          ))}

          <SourceBreadcrumbPage instance={instance} nodes={nodes} />
          <SourceBreadcrumbMore />
        </SourceBreadcrumbList>
      </BreadcrumbList>
    </Breadcrumb>
  );
}

function SourceBreadcrumbDirectory({
  directory,
  nodes,
  value,
}: {
  directory: { name: string; path: string };
  nodes: SourceTreeNode[];
  value: string;
}) {
  return (
    <BreadcrumbItem className="min-w-0">
      <SourceBreadcrumbPopover
        nodes={getSourceTreeSiblings(nodes, { kind: "folder", path: directory.path })}
        value={value}
      >
        <BreadcrumbLink className="max-w-32 truncate" title={directory.path}>
          {directory.name}
        </BreadcrumbLink>
      </SourceBreadcrumbPopover>
    </BreadcrumbItem>
  );
}

function SourceBreadcrumbPage({
  instance,
  nodes,
}: {
  instance: { displayName: string; id: string; sourcePath: string };
  nodes: SourceTreeNode[];
}) {
  const { displayName } = instance;
  const sourcePath = formatSourcePath(instance.sourcePath);

  return (
    <BreadcrumbItem className="min-w-0">
      <SourceBreadcrumbPopover
        nodes={getSourceTreeSiblings(nodes, { id: instance.id, kind: "instance" })}
        value={instance.id}
      >
        <BreadcrumbLink className="max-w-56 truncate" title={sourcePath}>
          {displayName}
        </BreadcrumbLink>
      </SourceBreadcrumbPopover>
    </BreadcrumbItem>
  );
}

function SourceBreadcrumbPopover({
  children,
  nodes,
  value,
}: PropsWithChildren<{ nodes: SourceTreeNode[]; value: string }>) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const filteredNodes = useMemo(
    () => filterSourceTreeNodes(nodes, deferredSearchQuery),
    [deferredSearchQuery, nodes],
  );

  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        align="start"
        className="flex h-96 max-h-(--radix-popover-content-available-height) w-80 flex-col gap-2 overflow-hidden p-1 pb-2.5"
        side="bottom"
      >
        <SearchBar
          aria-label={t("common.labels.search")}
          onValueChange={setSearchQuery}
          placeholder={t("source.messages.searchPlaceholder")}
          value={searchQuery}
        />
        {filteredNodes.length > 0 ? (
          <ScrollArea className="min-h-0 flex-1">
            <SourceTreeNodes
              background="popover"
              nodes={filteredNodes}
              searchQuery={deferredSearchQuery}
              value={value}
            />
          </ScrollArea>
        ) : (
          <p className="px-2 py-4 text-center text-xs text-muted-foreground">
            {t("source.messages.noSearchResults")}
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}

function SourceBreadcrumbMore() {
  return (
    <BreadcrumbItem>
      <Popover>
        <PopoverTrigger asChild>
          <Button className="h-auto max-w-56 min-w-0 gap-0 p-0" size="xs" variant="link">
            <BreadcrumbEllipsis />
          </Button>
        </PopoverTrigger>

        <PopoverContent align="start" className="w-80 p-2.5" side="bottom" sideOffset={5}>
          <SourceDetails />
        </PopoverContent>
      </Popover>
    </BreadcrumbItem>
  );
}

function SourceBreadcrumbList({ children }: PropsWithChildren) {
  return Children.toArray(children).flatMap((child, index) =>
    index === 0 ? [child] : [<BreadcrumbSeparator key={`breadcrumb-separator-${index}`} />, child],
  );
}

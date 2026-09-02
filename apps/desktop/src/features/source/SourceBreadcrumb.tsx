import { Children, type PropsWithChildren } from "react";

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

import { useAppSelector } from "@/app/store/redux-hooks";
import {
  selectActiveEditingInstance,
  selectEditingInstances,
} from "@/app/store/slices/editing-instances-slice";
import type { EditingInstance } from "@/domain/editing-instance";

import { SourceDetails } from "./components/SourceDetails";
import { SourceTreeNodes } from "./components/SourceTreeNodes";
import { formatSourcePath } from "./lib/media-formatters.utils";
import {
  getPathDirectories,
  getSourceTreeNodes,
  getSourceTreeSiblings,
  type SourceTreeNode,
} from "./lib/source-tree.utils";

export function SourceBreadcrumb() {
  const instance = useAppSelector(selectActiveEditingInstance);
  const instances = useAppSelector(selectEditingInstances);

  if (!instance) return null;

  const sourcePath = formatSourcePath(instance.snapshot.source.sourcePath);
  const directories = getPathDirectories(sourcePath);
  const nodes = getSourceTreeNodes(instances, { compact: false });

  return (
    <Breadcrumb className="min-w-0 px-2 pb-1">
      <BreadcrumbList className="flex-nowrap overflow-hidden text-xs">
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
  instance: EditingInstance;
  nodes: SourceTreeNode[];
}) {
  const { displayName } = instance.snapshot.source;
  const sourcePath = formatSourcePath(instance.snapshot.source.sourcePath);

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
  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        align="start"
        className="flex max-h-96 w-80 overflow-hidden p-1 py-2.5"
        side="bottom"
      >
        <ScrollArea className="flex-1">
          <SourceTreeNodes background="popover" nodes={nodes} value={value} />
        </ScrollArea>
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

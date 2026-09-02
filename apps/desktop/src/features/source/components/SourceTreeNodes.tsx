import { ChevronRightIcon, FileVideo, Folder, FolderOpen } from "lucide-react";
import type { ComponentProps, CSSProperties, PropsWithChildren } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

import { useAppDispatch } from "@/app/store/redux-hooks";
import { navigateToEditingInstance } from "@/app/store/thunks/source-media-thunks";
import type { EditingInstance } from "@/domain/editing-instance";
import { cn } from "@/lib/class-names.utils";

import { formatSourcePath } from "../lib/media-formatters.utils";
import {
  getSourceTreeInstances,
  type SourceTreeFolderNode,
  type SourceTreeNode,
} from "../lib/source-tree.utils";

import { SourceTreeContextMenu } from "./SourceTreeContextMenu";

const treeNodeClassName =
  "min-w-0 flex-1 text-xs justify-between overflow-hidden transition-none group-hover:bg-muted! dark:group-hover:bg-muted/50 text-secondary-foreground";

export function SourceTreeNodes({
  background = "card",
  level = 0,
  nodes,
  value,
}: {
  background?: "card" | "popover";
  level?: number;
  nodes: SourceTreeNode[];
  value: string;
}) {
  return nodes.map((node) => {
    if (node.kind === "folder") {
      return (
        <SourceTreeFolder
          background={background}
          key={node.id}
          level={level}
          node={node}
          value={value}
        />
      );
    }

    return (
      <SourceTreeInstance
        instance={node.instance}
        key={node.instance.id}
        level={level}
        selected={value === node.instance.id}
      />
    );
  });
}

function SourceTreeFolder({
  background,
  level,
  node,
  value,
}: {
  background: "card" | "popover";
  level: number;
  node: SourceTreeFolderNode;
  value: string;
}) {
  const instances = getSourceTreeInstances(node.children);

  return (
    <Collapsible className="w-full">
      <SourceTreeContextMenu
        kind="folder"
        revealPath={node.path}
        sourceIds={instances.map((instance) => instance.id)}
      >
        <div
          className="group group-line sticky flex min-w-0 items-center gap-1 bg-(--source-tree-background)"
          style={
            {
              "--source-tree-background": `var(--${background})`,
              top: level * 28,
              zIndex: 10 - level,
            } as CSSProperties
          }
        >
          <CollapsibleTrigger asChild>
            <Button
              aria-label={node.name}
              className={cn(treeNodeClassName, "group data-open:bg-transparent!")}
              size="sm"
              variant="ghost"
            >
              <div
                className="flex w-full min-w-0 items-center gap-1"
                style={{ paddingLeft: level * 8 }}
              >
                <ChevronRightIcon className="shrink-0 group-data-[state=open]:rotate-90" />
                <Folder className="shrink-0 group-data-[state=open]:hidden" />
                <FolderOpen className="hidden shrink-0 group-data-[state=open]:block" />

                <span className="truncate">{node.name}</span>
              </div>

              <SourceTreeStatus title={String(instances.length)}>
                ({instances.length})
              </SourceTreeStatus>
            </Button>
          </CollapsibleTrigger>
        </div>
      </SourceTreeContextMenu>

      <CollapsibleContent>
        <SourceTreeNodes
          background={background}
          level={level + 1}
          nodes={node.children}
          value={value}
        />
      </CollapsibleContent>
    </Collapsible>
  );
}

function SourceTreeInstance({
  instance,
  level,
  selected,
}: {
  instance: EditingInstance;
  level: number;
  selected: boolean;
}) {
  const dispatch = useAppDispatch();
  const attempt = instance.exportAttempts.at(-1);

  const status =
    instance.sourceAvailability === "deleted"
      ? "deleted"
      : (attempt?.state.status ?? (instance.media ? "ready" : undefined));

  const isLoading = status === "rendering";

  return (
    <SourceTreeContextMenu
      kind="file"
      revealPath={formatSourcePath(instance.snapshot.source.sourcePath)}
      sourceIds={[instance.id]}
    >
      <div
        className="group group-line relative flex min-w-0 items-center gap-1 rounded-md"
        data-open={selected}
      >
        <Button
          aria-current={selected ? "true" : undefined}
          aria-label={instance.snapshot.source.displayName}
          className={treeNodeClassName}
          data-open={selected ? "true" : undefined}
          onClick={() => void dispatch(navigateToEditingInstance(instance.id))}
          size="xs"
          variant="ghost"
        >
          <span className="flex min-w-0 items-center gap-1" style={{ paddingLeft: level * 8 + 16 }}>
            <FileVideo className="shrink-0" />

            <span className="truncate">{instance.snapshot.source.displayName}</span>
          </span>

          {status ? (
            <SourceTreeStatus className={isLoading ? "shimmer" : undefined} title={status}>
              <Badge
                className="text-muted-foreground transition-none"
                size="xs"
                variant={getStatusVariant(status)}
              >
                {status}
              </Badge>
            </SourceTreeStatus>
          ) : null}
        </Button>
      </div>
    </SourceTreeContextMenu>
  );
}

function SourceTreeStatus({
  children,
  className,
  title,
}: PropsWithChildren<{ className?: string; title?: string }>) {
  return (
    <span className={cn("shrink-0 text-[10px] text-muted-foreground", className)} title={title}>
      {children}
    </span>
  );
}

function getStatusVariant(
  status:
    "deleted" | "queued" | "rendering" | "completed" | "failed" | "canceled" | "ready" | undefined,
): ComponentProps<typeof Badge>["variant"] {
  switch (status) {
    case "deleted":
    case "canceled":
    case "failed":
      return "destructive";

    case "completed":
      return "success";

    default:
      return "outline";
  }
}

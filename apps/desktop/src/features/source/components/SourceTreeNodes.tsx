import { ChevronRightIcon, FileVideo, Folder, FolderOpen } from "lucide-react";
import {
  type ComponentProps,
  type CSSProperties,
  memo,
  type PropsWithChildren,
  useMemo,
} from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import { selectEditingInstanceStatusById } from "@/app/store/slices/editing-instances-slice";
import { navigateToEditingInstance } from "@/app/store/thunks/source-media-thunks";
import { cn } from "@/lib/class-names.utils";

import { formatSourcePath } from "../lib/media-formatters.utils";
import {
  getSourceTreeInstanceIds,
  type SourceTreeFolderNode,
  type SourceTreeNode,
} from "../lib/source-tree.utils";

import { SourceTreeContextMenu } from "./SourceTreeContextMenu";

const treeNodeClassName =
  "min-w-0 flex-1 text-xs justify-between overflow-hidden transition-none group-hover:bg-muted! dark:group-hover:bg-muted/50 pr-1";

type SourceTreeNodesProps = {
  background?: "card" | "popover";
  level?: number;
  nodes: SourceTreeNode[];
  value: string;
};

export function SourceTreeNodes({
  background = "card",
  level = 0,
  nodes,
  value,
}: SourceTreeNodesProps) {
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
        displayName={node.displayName}
        instanceId={node.instanceId}
        key={node.instanceId}
        level={level}
        selected={value === node.instanceId}
        sourcePath={node.sourcePath}
      />
    );
  });
}

const SourceTreeFolder = memo(function SourceTreeFolder({
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
  const sourceIds = useMemo(() => getSourceTreeInstanceIds(node.children), [node.children]);

  return (
    <Collapsible className="w-full">
      <SourceTreeContextMenu kind="folder" revealPath={node.path} sourceIds={sourceIds}>
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
              className={cn(
                treeNodeClassName,
                "group text-secondary-foreground! data-open:bg-transparent!",
              )}
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

              <SourceTreeStatus title={String(sourceIds.length)}>
                <Badge variant="ghost">{sourceIds.length}</Badge>
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
});

const SourceTreeInstance = memo(function SourceTreeInstance({
  displayName,
  instanceId,
  level,
  selected,
  sourcePath,
}: {
  displayName: string;
  instanceId: string;
  level: number;
  selected: boolean;
  sourcePath: string;
}) {
  const dispatch = useAppDispatch();
  const status = useAppSelector((state) => selectEditingInstanceStatusById(state, instanceId));

  const isLoading = status === "rendering";

  return (
    <SourceTreeContextMenu
      kind="file"
      revealPath={formatSourcePath(sourcePath)}
      sourceIds={[instanceId]}
    >
      <div
        className="group group-line relative flex min-w-0 items-center gap-1 rounded-md"
        data-open={selected}
      >
        <Button
          aria-current={selected ? "true" : undefined}
          aria-label={displayName}
          className={cn(treeNodeClassName, "text-muted-foreground!")}
          data-open={selected ? "true" : undefined}
          onClick={() => void dispatch(navigateToEditingInstance(instanceId))}
          size="xs"
          variant="ghost"
        >
          <span className="flex min-w-0 items-center gap-1" style={{ paddingLeft: level * 8 + 16 }}>
            <FileVideo className="shrink-0" />

            <span className="truncate">{displayName}</span>
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
});

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

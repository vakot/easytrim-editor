import {
  ChevronRightIcon,
  FileVideo,
  Folder,
  FolderOpen,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import type { PropsWithChildren } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";

import { useAppDispatch } from "@/app/store/redux-hooks";
import {
  navigateToEditingInstance,
  restoreSourceFileRequested,
} from "@/app/store/thunks/source-media-thunks";
import type { EditingInstance } from "@/domain/editing-instance";
import { cn } from "@/lib/class-names.utils";

import { DeleteSourceDialog, DeleteSourceDialogTrigger } from "./components/DeleteSourceDialog";
import { useEditingInstances } from "./hooks/useEditingInstances";
import { formatSourcePath } from "./lib/media-formatters.utils";

type SourceTreeNode =
  | { children: SourceTreeNode[]; id: string; kind: "folder"; name: string }
  | { instance: EditingInstance; kind: "instance" };

type SourceTreeActions = {
  onClose: (ids: string[]) => void;
  onRestore: (sourcePaths: string[]) => void;
  onSelect: (id: string) => void;
  value: string;
};

export function SourceTree() {
  const dispatch = useAppDispatch();

  const { activeInstanceId, closeInstances, instances } = useEditingInstances();

  const restoreSources = async (sourcePaths: string[]) => {
    for (const sourcePath of new Set(sourcePaths)) {
      await dispatch(restoreSourceFileRequested({ sourcePath }));
    }
  };

  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="flex flex-col gap-1 p-1">
        <SourceTreeNodes
          nodes={getSourceTreeNodes(instances)}
          onClose={(ids) => void closeInstances(ids)}
          onRestore={(paths) => void restoreSources(paths)}
          onSelect={(id) => void dispatch(navigateToEditingInstance(id))}
          value={activeInstanceId ?? ""}
        />
      </div>
    </ScrollArea>
  );
}

function SourceTreeNodes({
  level = 0,
  nodes,
  onClose,
  onRestore,
  onSelect,
  value,
}: { level?: number; nodes: SourceTreeNode[] } & SourceTreeActions) {
  return nodes.map((node) =>
    node.kind === "folder" ? (
      <SourceTreeFolder
        key={node.id}
        level={level}
        node={node}
        onClose={onClose}
        onRestore={onRestore}
        onSelect={onSelect}
        value={value}
      />
    ) : (
      <SourceTreeInstance
        instance={node.instance}
        key={node.instance.id}
        level={level}
        onClose={onClose}
        onRestore={onRestore}
        onSelect={onSelect}
        selected={value === node.instance.id}
      />
    ),
  );
}

function SourceTreeFolder({
  level,
  node,
  ...props
}: { level: number; node: Extract<SourceTreeNode, { kind: "folder" }> } & SourceTreeActions) {
  const instances = getSourceTreeInstances(node.children);

  return (
    <Collapsible className="w-full">
      <div className="group group-line relative flex min-w-0 items-center gap-1 rounded-md pr-1">
        <CollapsibleTrigger asChild>
          <Button
            className="group min-w-0 flex-1 justify-between transition-none group-focus-within:bg-muted group-focus-within:pr-4 group-focus-within:text-foreground! group-hover:bg-muted group-hover:pr-4 group-hover:text-foreground! dark:group-focus-within:bg-muted/50 dark:group-hover:bg-muted/50"
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

            <SourceTreeStatus title={instances.length.toString()}>
              ({instances.length})
            </SourceTreeStatus>
          </Button>
        </CollapsibleTrigger>

        <SourceTreeActionGroup
          instances={instances}
          onClose={props.onClose}
          onRestore={props.onRestore}
        />
      </div>
      <CollapsibleContent>
        <SourceTreeNodes {...props} level={level + 1} nodes={node.children} />
      </CollapsibleContent>
    </Collapsible>
  );
}

function SourceTreeInstance({
  instance,
  level,
  onClose,
  onRestore,
  onSelect,
  selected,
}: {
  instance: EditingInstance;
  level: number;
  onClose: (ids: string[]) => void;
  onRestore: (sourcePaths: string[]) => void;
  onSelect: (id: string) => void;
  selected: boolean;
}) {
  const attempt = instance.exportAttempts.at(-1);
  const status =
    instance.sourceAvailability === "deleted"
      ? "deleted"
      : (attempt?.state.status ?? (instance.media ? "ready" : undefined));

  const statusLabel =
    status === "completed" && attempt?.state.status === "completed" ? "completed" : status;

  const isLoading = status === "rendering";

  return (
    <div
      className="group group-line relative flex min-w-0 items-center gap-1 rounded-md pr-1"
      data-open={selected}
    >
      <Button
        className="min-w-0 flex-1 justify-between overflow-hidden text-muted-foreground! transition-none group-focus-within:pr-12 group-focus-within:text-foreground! group-hover:bg-muted group-hover:pr-12 group-hover:text-foreground! dark:group-hover:bg-muted/50"
        onClick={() => onSelect(instance.id)}
        size="xs"
        variant="ghost"
      >
        <span className="flex min-w-0 items-center gap-1" style={{ paddingLeft: level * 8 + 16 }}>
          <FileVideo className="shrink-0" />
          <span className="truncate">{instance.snapshot.source.displayName}</span>
        </span>

        {statusLabel ? (
          <SourceTreeStatus className={isLoading ? "shimmer" : undefined} title={statusLabel}>
            <Badge
              className="text-muted-foreground transition-none"
              size="xs"
              variant={getStatusVariant(status)}
            >
              {statusLabel}
            </Badge>
          </SourceTreeStatus>
        ) : null}
      </Button>

      <SourceTreeActionGroup instances={[instance]} onClose={onClose} onRestore={onRestore} />
    </div>
  );
}

function SourceTreeActionGroup({
  instances,
  onClose,
  onRestore,
}: Pick<SourceTreeActions, "onClose" | "onRestore"> & {
  instances: EditingInstance[];
}) {
  if (instances.length === 0) return null;

  const availableInstances = instances.filter(
    (instance) => instance.sourceAvailability !== "deleted",
  );

  const actionInstances = availableInstances.length > 0 ? availableInstances : instances;
  const isRestore = availableInstances.length === 0;
  const isMultiple = instances.length > 1;

  return (
    <ButtonGroup className="invisible absolute right-0 group-focus-within:visible group-hover:visible">
      <Button
        aria-label={isMultiple ? "Close editing instances" : "Close editing instance"}
        className="transition-none"
        onClick={() => onClose(instances.map((instance) => instance.id))}
        size="icon-xs"
        type="button"
        variant="secondary"
      >
        <X aria-hidden="true" />
      </Button>

      {isRestore ? (
        <Button
          aria-label={isMultiple ? "Restore sources" : "Restore source"}
          className="transition-none"
          onClick={() =>
            onRestore(actionInstances.map((instance) => instance.snapshot.source.sourcePath))
          }
          size="icon-xs"
          type="button"
          variant="success"
        >
          <RotateCcw aria-hidden="true" />
        </Button>
      ) : (
        <DeleteSourceDialog sourceIds={actionInstances.map((instance) => instance.id)}>
          <DeleteSourceDialogTrigger asChild>
            <Button
              aria-label={isMultiple ? "Delete sources" : "Delete source"}
              className="transition-none"
              size="icon-xs"
              type="button"
              variant="destructive"
            >
              <Trash2 aria-hidden="true" />
            </Button>
          </DeleteSourceDialogTrigger>
        </DeleteSourceDialog>
      )}
    </ButtonGroup>
  );
}

function SourceTreeStatus({
  children,
  className,
  title,
}: PropsWithChildren<{ className?: string; title?: string }>) {
  return (
    <span
      className={cn(
        "shrink-0 text-[10px] text-muted-foreground group-focus-within:hidden group-hover:hidden",
        className,
      )}
      title={title}
    >
      {children}
    </span>
  );
}

function getSourceTreeNodes(instances: EditingInstance[]): SourceTreeNode[] {
  if (instances.length === 0) return [];
  const entries = instances.map((instance) => ({
    directories: getPathDirectories(formatSourcePath(instance.snapshot.source.sourcePath)),
    instance,
  }));

  const commonDepth = getCommonPathDepth(entries.map(({ directories }) => directories));
  const rootPath = entries[0]?.directories.slice(0, commonDepth).join("\\") ?? "";
  const roots: SourceTreeNode[] = [];
  const rootFolder =
    commonDepth > 0
      ? { children: [], id: `folder:${rootPath}`, kind: "folder" as const, name: rootPath }
      : undefined;

  if (rootFolder) roots.push(rootFolder);
  for (const { directories, instance } of entries) {
    let children: SourceTreeNode[] = rootFolder ? rootFolder.children : roots;
    let currentPath = rootPath;
    for (const directory of directories.slice(commonDepth)) {
      currentPath = currentPath ? `${currentPath}\\${directory}` : directory;
      let folder = children.find(
        (node): node is Extract<SourceTreeNode, { kind: "folder" }> =>
          node.kind === "folder" && node.id === `folder:${currentPath}`,
      );

      if (!folder) {
        folder = { children: [], id: `folder:${currentPath}`, kind: "folder", name: directory };
        children.push(folder);
      }
      children = folder.children;
    }
    children.push({ instance, kind: "instance" });
  }
  return roots;
}

function getSourceTreeInstances(nodes: SourceTreeNode[]): EditingInstance[] {
  return nodes.flatMap((node) =>
    node.kind === "folder" ? getSourceTreeInstances(node.children) : [node.instance],
  );
}

function getPathDirectories(path: string) {
  return path.split(/[\\/]/).slice(0, -1);
}

function getCommonPathDepth(paths: string[][]) {
  const first = paths[0];
  if (!first) return 0;
  let depth = 0;
  while (depth < first.length && paths.every((path) => path[depth] === first[depth])) depth++;
  return depth;
}

function getStatusVariant(
  status:
    "deleted" | "queued" | "rendering" | "completed" | "failed" | "canceled" | "ready" | undefined,
): React.ComponentProps<typeof Badge>["variant"] {
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

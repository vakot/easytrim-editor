import {
  ChevronRightIcon,
  FileVideo,
  Folder,
  FolderOpen,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import type { ComponentProps, PropsWithChildren } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

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

type SourceTreeNode = SourceTreeFolderNode | SourceTreeInstanceNode;

type SourceTreeFolderNode = {
  children: SourceTreeNode[];
  id: string;
  kind: "folder";
  name: string;
};

type SourceTreeInstanceNode = {
  instance: EditingInstance;
  kind: "instance";
};

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
    <div className="flex flex-col gap-1 p-1">
      <SourceTreeNodes
        nodes={getSourceTreeNodes(instances)}
        onClose={(ids) => void closeInstances(ids)}
        onRestore={(sourcePaths) => void restoreSources(sourcePaths)}
        onSelect={(id) => void dispatch(navigateToEditingInstance(id))}
        value={activeInstanceId ?? ""}
      />
    </div>
  );
}

function SourceTreeNodes({
  level = 0,
  nodes,
  onClose,
  onRestore,
  onSelect,
  value,
}: {
  level?: number;
  nodes: SourceTreeNode[];
} & SourceTreeActions) {
  return nodes.map((node) => {
    if (node.kind === "folder") {
      return (
        <SourceTreeFolder
          key={node.id}
          level={level}
          node={node}
          onClose={onClose}
          onRestore={onRestore}
          onSelect={onSelect}
          value={value}
        />
      );
    }

    return (
      <SourceTreeInstance
        instance={node.instance}
        key={node.instance.id}
        level={level}
        onClose={onClose}
        onRestore={onRestore}
        onSelect={onSelect}
        selected={value === node.instance.id}
      />
    );
  });
}

function SourceTreeFolder({
  level,
  node,
  onClose,
  onRestore,
  onSelect,
  value,
}: {
  level: number;
  node: SourceTreeFolderNode;
} & SourceTreeActions) {
  const instances = getSourceTreeInstances(node.children);

  return (
    <Collapsible className="w-full">
      <div className="group group-line relative flex min-w-0 items-center gap-1 rounded-md">
        <CollapsibleTrigger asChild>
          <Button
            className="group min-w-0 flex-1 justify-between text-xs transition-none group-focus-within:bg-muted! group-focus-within:pr-4 group-focus-within:text-foreground! group-hover:bg-muted! group-hover:pr-4 group-hover:text-foreground! dark:group-focus-within:bg-muted/50! dark:group-hover:bg-muted/50! data-open:bg-transparent!"
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

        <SourceTreeActionGroup instances={instances} onClose={onClose} onRestore={onRestore} />
      </div>

      <CollapsibleContent>
        <SourceTreeNodes
          level={level + 1}
          nodes={node.children}
          onClose={onClose}
          onRestore={onRestore}
          onSelect={onSelect}
          value={value}
        />
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

  const isLoading = status === "rendering";

  return (
    <div
      className="group group-line relative flex min-w-0 items-center gap-1 rounded-md"
      data-open={selected}
    >
      <Button
        aria-current={selected ? "true" : undefined}
        className="min-w-0 flex-1 justify-between overflow-hidden text-muted-foreground! transition-none group-focus-within:pr-12 group-focus-within:text-foreground! group-hover:bg-muted group-hover:pr-12 group-hover:text-foreground! dark:group-hover:bg-muted/50 data-open:text-foreground!"
        data-open={selected ? "true" : undefined}
        onClick={() => onSelect(instance.id)}
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

type SourceTreeBuildFolderNode = {
  children: SourceTreeBuildNode[];
  id: string;
  kind: "folder";
  name: string;
  path: string;
};

type SourceTreeBuildNode = SourceTreeBuildFolderNode | SourceTreeInstanceNode;

function getSourceTreeNodes(instances: EditingInstance[]): SourceTreeNode[] {
  if (instances.length === 0) return [];

  const root: SourceTreeBuildFolderNode = {
    children: [],
    id: "root",
    kind: "folder",
    name: "",
    path: "",
  };

  for (const instance of instances) {
    const directories = getPathDirectories(formatSourcePath(instance.snapshot.source.sourcePath));

    let parent = root;
    let currentPath = "";

    for (const directory of directories) {
      currentPath = currentPath ? `${currentPath}\\${directory}` : directory;

      let folder = parent.children.find(
        (node): node is SourceTreeBuildFolderNode =>
          node.kind === "folder" && node.path === currentPath,
      );

      if (!folder) {
        folder = {
          children: [],
          id: `folder:${currentPath}`,
          kind: "folder",
          name: directory,
          path: currentPath,
        };

        parent.children.push(folder);
      }

      parent = folder;
    }

    parent.children.push({
      instance,
      kind: "instance",
    });
  }

  const compactedRoot = compactFolderChains(root);

  return compactedRoot.name
    ? [stripBuildFolderFields(compactedRoot)]
    : compactedRoot.children.map(stripBuildFolderFields);
}

function compactFolderChains(folder: SourceTreeBuildFolderNode): SourceTreeBuildFolderNode {
  let current = folder;
  const pathParts = folder.name ? [folder.name] : [];

  while (current.children.length === 1 && current.children[0]?.kind === "folder") {
    current = current.children[0];
    pathParts.push(current.name);
  }

  return {
    ...current,
    name: pathParts.join("\\"),
    children: current.children.map((child) =>
      child.kind === "folder" ? compactFolderChains(child) : child,
    ),
  };
}

function stripBuildFolderFields(node: SourceTreeBuildNode): SourceTreeNode {
  if (node.kind === "instance") {
    return node;
  }

  return {
    children: node.children.map(stripBuildFolderFields),
    id: node.id,
    kind: "folder",
    name: node.name,
  };
}

function getSourceTreeInstances(nodes: SourceTreeNode[]): EditingInstance[] {
  return nodes.flatMap((node) =>
    node.kind === "folder" ? getSourceTreeInstances(node.children) : [node.instance],
  );
}

function getPathDirectories(path: string): string[] {
  return path.split(/[\\/]/).slice(0, -1);
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

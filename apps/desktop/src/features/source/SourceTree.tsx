import type { TFunction } from "i18next";
import { ChevronRightIcon, FileVideo, Folder, FolderOpen } from "lucide-react";
import type { ComponentProps, PropsWithChildren } from "react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import { selectEditingInstances } from "@/app/store/slices/editing-instances-slice";
import {
  closeActiveEditingInstanceRequested,
  navigateToEditingInstance,
  restoreSourceFileRequested,
} from "@/app/store/thunks/source-media-thunks";
import type { EditingInstance } from "@/domain/editing-instance";
import { cn } from "@/lib/class-names.utils";
import { openFileLocation } from "@/lib/tauri/media";
import { isWindowsRuntime } from "@/lib/tauri/updates.utils";

import { DeleteSourceDialog, DeleteSourceDialogTrigger } from "./components/DeleteSourceDialog";
import { useEditingInstances } from "./hooks/useEditingInstances";
import { formatSourcePath } from "./lib/media-formatters.utils";

type SourceTreeNode = SourceTreeFolderNode | SourceTreeInstanceNode;

type SourceTreeFolderNode = {
  children: SourceTreeNode[];
  id: string;
  kind: "folder";
  name: string;
  path: string;
};

type SourceTreeInstanceNode = {
  instance: EditingInstance;
  kind: "instance";
};

export function SourceTree() {
  const { activeInstanceId, instances } = useEditingInstances();

  return (
    <div className="flex flex-col gap-1">
      <SourceTreeNodes nodes={getSourceTreeNodes(instances)} value={activeInstanceId ?? ""} />
    </div>
  );
}

function SourceTreeNodes({
  level = 0,
  nodes,
  value,
}: {
  level?: number;
  nodes: SourceTreeNode[];
  value: string;
}) {
  return nodes.map((node) => {
    if (node.kind === "folder") {
      return <SourceTreeFolder key={node.id} level={level} node={node} value={value} />;
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
  level,
  node,
  value,
}: {
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
          className="group group-line sticky flex min-w-0 items-center gap-1 rounded-md bg-card"
          style={{ top: level * 28, zIndex: 10 - level }}
        >
          <CollapsibleTrigger asChild>
            <Button
              aria-label={node.name}
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
        </div>
      </SourceTreeContextMenu>

      <CollapsibleContent>
        <SourceTreeNodes level={level + 1} nodes={node.children} value={value} />
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
          className="min-w-0 flex-1 justify-between overflow-hidden text-muted-foreground! transition-none group-focus-within:text-foreground! group-hover:bg-muted group-hover:text-foreground! dark:group-hover:bg-muted/50 data-open:text-foreground!"
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

function SourceTreeContextMenu({
  children,
  kind,
  revealPath,
  sourceIds,
}: PropsWithChildren<{
  kind: "file" | "folder";
  revealPath: string;
  sourceIds: string[];
}>) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const instances = useAppSelector(selectEditingInstances);
  const targetInstances = instances.filter((instance) => sourceIds.includes(instance.id));
  const sourceAction = getSourceAction(targetInstances);

  const closeSources = () => {
    for (const sourceId of sourceIds) {
      void dispatch(closeActiveEditingInstanceRequested(sourceId));
    }
  };

  const revealSource = () => {
    void openFileLocation(revealPath).catch(() => undefined);
  };

  const restoreSources = () => {
    const sourcesByPath = new Map<string, string>();
    for (const instance of targetInstances) {
      if (instance.sourceAvailability === "deleted") {
        sourcesByPath.set(instance.snapshot.source.sourcePath, instance.id);
      }
    }
    for (const [sourcePath, itemId] of sourcesByPath) {
      void dispatch(restoreSourceFileRequested({ itemId, sourcePath }));
    }
  };

  return (
    <DeleteSourceDialog sourceIds={sourceIds}>
      <ContextMenu>
        <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuGroup>
            {kind === "file" ? (
              <ContextMenuItem
                onSelect={() => {
                  const sourceId = sourceIds[0];
                  if (sourceId) void dispatch(navigateToEditingInstance(sourceId));
                }}
              >
                {t("app.actions.open")}
              </ContextMenuItem>
            ) : null}
            <ContextMenuItem onSelect={closeSources}>{t("common.actions.close")}</ContextMenuItem>
          </ContextMenuGroup>
          <ContextMenuSeparator />
          <ContextMenuGroup>
            <ContextMenuItem disabled={sourceAction === "restore"} onSelect={revealSource}>
              {getRevealLabel(t)}
            </ContextMenuItem>
          </ContextMenuGroup>
          <ContextMenuSeparator />
          <ContextMenuGroup>
            {sourceAction === "restore" ? (
              <ContextMenuItem onSelect={restoreSources} variant="success">
                {t("app.actions.restore")}
              </ContextMenuItem>
            ) : (
              <DeleteSourceDialogTrigger asChild>
                <ContextMenuItem onSelect={(event) => event.preventDefault()} variant="destructive">
                  {t("common.actions.delete")}
                </ContextMenuItem>
              </DeleteSourceDialogTrigger>
            )}
          </ContextMenuGroup>
        </ContextMenuContent>
      </ContextMenu>
    </DeleteSourceDialog>
  );
}

function getSourceAction(instances: EditingInstance[]): "delete" | "restore" {
  return instances.length > 0 &&
    instances.every((instance) => instance.sourceAvailability === "deleted")
    ? "restore"
    : "delete";
}

function getRevealLabel(t: TFunction): string {
  if (isMacOSRuntime()) return t("source.actions.revealInFinder");
  if (isWindowsRuntime()) return t("source.actions.revealInFileExplorer");
  return t("source.actions.revealInFileManager");
}

function isMacOSRuntime(): boolean {
  return (
    typeof navigator !== "undefined" &&
    (/Mac/i.test(navigator.userAgent) || /Mac/i.test(navigator.platform))
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

    for (const directory of directories) {
      let folder = parent.children.find(
        (node): node is SourceTreeBuildFolderNode =>
          node.kind === "folder" && node.path === directory.path,
      );

      if (!folder) {
        folder = {
          children: [],
          id: `folder:${directory.path}`,
          kind: "folder",
          name: directory.name,
          path: directory.path,
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
    path: node.path,
  };
}

function getSourceTreeInstances(nodes: SourceTreeNode[]): EditingInstance[] {
  return nodes.flatMap((node) =>
    node.kind === "folder" ? getSourceTreeInstances(node.children) : [node.instance],
  );
}

function getPathDirectories(path: string): Array<{ name: string; path: string }> {
  const separator = path.includes("\\") ? "\\" : "/";
  const directoryPath = path.slice(0, Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\")));
  const driveRoot = directoryPath.match(/^[A-Za-z]:[\\/]/)?.[0];
  const root = directoryPath.startsWith(separator) ? separator : "";
  let currentPath = driveRoot ?? root;

  const directories = directoryPath.slice(currentPath.length).split(/[\\/]/).filter(Boolean);

  if (driveRoot) {
    directories.unshift(driveRoot.slice(0, 2));
  }

  return directories.map((name) => {
    if (name === driveRoot?.slice(0, 2)) {
      currentPath = driveRoot;
    } else {
      currentPath = currentPath
        ? `${currentPath}${currentPath.endsWith(separator) ? "" : separator}${name}`
        : name;
    }

    return { name, path: currentPath };
  });
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

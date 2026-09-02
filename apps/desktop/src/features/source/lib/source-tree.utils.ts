import type { TFunction } from "i18next";

import type { EditingInstance } from "@/domain/editing-instance";
import { isWindowsRuntime } from "@/lib/tauri/updates.utils";

import { formatSourcePath } from "./media-formatters.utils";

export type SourceTreeNode = SourceTreeFolderNode | SourceTreeInstanceNode;

export type SourceTreeFolderNode = {
  children: SourceTreeNode[];
  id: string;
  kind: "folder";
  name: string;
  path: string;
};

export type SourceTreeInstanceNode = {
  instance: EditingInstance;
  kind: "instance";
};

type SourceTreeBuildFolderNode = {
  children: SourceTreeBuildNode[];
  id: string;
  kind: "folder";
  name: string;
  path: string;
};

type SourceTreeBuildNode = SourceTreeBuildFolderNode | SourceTreeInstanceNode;

const sourceTreeNodeCollator = new Intl.Collator(undefined, {
  sensitivity: "base",
});

export function getSourceTreeNodes(
  instances: EditingInstance[],
  options: { compact?: boolean } = {},
): SourceTreeNode[] {
  if (instances.length === 0) return [];

  const root: SourceTreeBuildFolderNode = {
    children: [],
    id: "root",
    kind: "folder",
    name: "",
    path: "",
  };

  const foldersByPath = new Map<string, SourceTreeBuildFolderNode>();

  for (const instance of instances) {
    const directories = getPathDirectories(formatSourcePath(instance.snapshot.source.sourcePath));

    let parent = root;

    for (const directory of directories) {
      let folder = foldersByPath.get(directory.path);

      if (!folder) {
        folder = {
          children: [],
          id: `folder:${directory.path}`,
          kind: "folder",
          name: directory.name,
          path: directory.path,
        };

        parent.children.push(folder);
        foldersByPath.set(directory.path, folder);
      }

      parent = folder;
    }

    parent.children.push({
      instance,
      kind: "instance",
    });
  }

  const compactedRoot = options.compact === false ? root : compactFolderChains(root);
  sortSourceTreeChildren(compactedRoot);

  return compactedRoot.name
    ? [stripBuildFolderFields(compactedRoot)]
    : compactedRoot.children.map(stripBuildFolderFields);
}

export function getSourceTreeInstances(nodes: SourceTreeNode[]): EditingInstance[] {
  return nodes.flatMap((node) =>
    node.kind === "folder" ? getSourceTreeInstances(node.children) : [node.instance],
  );
}

export function getSourceTreeInstanceIds(nodes: SourceTreeNode[]): string[] {
  const sourceIds: string[] = [];
  const pendingNodes = [...nodes].reverse();

  while (pendingNodes.length > 0) {
    const node = pendingNodes.pop();
    if (!node) continue;

    if (node.kind === "folder") {
      for (let index = node.children.length - 1; index >= 0; index -= 1) {
        const child = node.children[index];
        if (child) pendingNodes.push(child);
      }
    } else {
      sourceIds.push(node.instance.id);
    }
  }

  return sourceIds;
}

export function getSourceTreeSiblings(
  nodes: SourceTreeNode[],
  target: { kind: "folder"; path: string } | { id: string; kind: "instance" },
): SourceTreeNode[] {
  return findSourceTreeSiblings(nodes, target) ?? [];
}

export function getSourceAction(instances: EditingInstance[]): "delete" | "restore" {
  return instances.length > 0 &&
    instances.every((instance) => instance.sourceAvailability === "deleted")
    ? "restore"
    : "delete";
}

export function getRevealLabel(t: TFunction): string {
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

function findSourceTreeSiblings(
  nodes: SourceTreeNode[],
  target: { kind: "folder"; path: string } | { id: string; kind: "instance" },
): SourceTreeNode[] | undefined {
  for (const node of nodes) {
    if (
      (target.kind === "folder" &&
        node.kind === "folder" &&
        (node.path === target.path || isDriveRootPath(target.path, node.path))) ||
      (target.kind === "instance" && node.kind === "instance" && node.instance.id === target.id)
    ) {
      return nodes;
    }

    if (node.kind === "folder") {
      const siblings = findSourceTreeSiblings(node.children, target);
      if (siblings) return siblings;
    }
  }
}

function isDriveRootPath(targetPath: string, nodePath: string): boolean {
  return /^[A-Za-z]:[\\/]$/.test(targetPath) && nodePath.startsWith(targetPath);
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

function sortSourceTreeChildren(folder: SourceTreeBuildFolderNode): void {
  folder.children.sort((left, right) => {
    if (left.kind !== right.kind) return left.kind === "folder" ? -1 : 1;

    const leftName = left.kind === "folder" ? left.name : left.instance.snapshot.source.displayName;
    const rightName =
      right.kind === "folder" ? right.name : right.instance.snapshot.source.displayName;

    return sourceTreeNodeCollator.compare(leftName, rightName);
  });

  for (const child of folder.children) {
    if (child.kind === "folder") sortSourceTreeChildren(child);
  }
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

export function getPathDirectories(path: string): Array<{ name: string; path: string }> {
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

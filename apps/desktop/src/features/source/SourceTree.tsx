import { ChevronRightIcon, FileVideo, Folder, FolderOpen } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";

import type { ImportQueueItem } from "@/app/store/slices/export-slice";

import { useImportQueue } from "./hooks/useImportQueue";
import { formatSourcePath } from "./lib/media-formatters.utils";

type SourceTreeNode = SourceTreeFolderNode | SourceTreeSnapshotNode;

type SourceTreeFolderNode = {
  children: SourceTreeNode[];
  id: string;
  name: string;
};

type SourceTreeSnapshotNode = ImportQueueItem["snapshot"] & Pick<ImportQueueItem, "id">;

export function SourceTree() {
  const { t } = useTranslation();

  const { activeItem, items, open } = useImportQueue();

  const handleSelect = (snapshotNode: SourceTreeSnapshotNode) => {
    console.log(snapshotNode);
    open(snapshotNode.id);
  };

  return (
    <aside aria-label={t("source.labels.title")} className="flex size-full flex-col pt-3">
      <h3
        className="mx-3 font-heading text-xs font-bold tracking-[0.16em] text-primary uppercase"
        id="source-panel-title"
      >
        {t("source.labels.title")}
      </h3>
      <ScrollArea>
        <div className="flex flex-1 flex-col gap-1 p-1">
          <SourceTreeNodes
            nodes={getSourceTreeNodes(items)}
            onSelect={handleSelect}
            value={activeItem?.id ?? ""}
          />
        </div>
      </ScrollArea>
    </aside>
  );
}

function SourceTreeNodes({
  level = 0,
  nodes,
  onSelect,
  value,
}: {
  level?: number;
  nodes: SourceTreeNode[];
  onSelect?: (snapshotNode: SourceTreeSnapshotNode) => void;
  value: string;
}) {
  return (
    <>
      {nodes.map((node) => (
        <SourceTreeNodeItem
          key={node.id}
          level={level}
          node={node}
          onSelect={onSelect}
          value={value}
        />
      ))}
    </>
  );
}

interface SourceTreeNodeProps<T = SourceTreeNode> {
  level: number;
  node: T;
  onSelect?: (snapshot: SourceTreeSnapshotNode) => void;
  value: string;
}

const SOURCE_TREE_NODE_OFFSET = 2;

function SourceTreeNodeItem({ level = 0, node, onSelect, value }: SourceTreeNodeProps) {
  if ("children" in node) {
    return <SourceTreeFolder level={level} node={node} onSelect={onSelect} value={value} />;
  }

  return (
    <SourceTreeSnapshot
      level={level}
      node={node as SourceTreeSnapshotNode}
      onSelect={onSelect}
      value={value}
    />
  );
}

function SourceTreeSnapshot({
  level = 0,
  node,
  onSelect,
  value,
}: SourceTreeNodeProps<SourceTreeSnapshotNode>) {
  const isSelected = value === node.id;

  return (
    <Button
      className="w-full justify-start overflow-hidden text-muted-foreground!"
      data-open={isSelected}
      onClick={() => onSelect?.(node)}
      size="xs"
      variant="ghost"
    >
      <div
        className="flex w-full items-center gap-1"
        style={{ paddingLeft: level * SOURCE_TREE_NODE_OFFSET * 4 + 16 }}
      >
        <FileVideo />
        <span className="truncate">{node.source.displayName}</span>
      </div>
    </Button>
  );
}

function SourceTreeFolder({
  level = 0,
  node,
  onSelect,
  value,
}: SourceTreeNodeProps<SourceTreeFolderNode>) {
  return (
    <Collapsible className="w-full">
      <CollapsibleTrigger asChild>
        <Button
          className="group w-full justify-start data-open:bg-transparent"
          size="sm"
          variant="ghost"
        >
          <div
            className="flex w-full items-center gap-1"
            style={{ paddingLeft: level * SOURCE_TREE_NODE_OFFSET * 4 }}
          >
            <ChevronRightIcon className="group-data-[state=open]:rotate-90" />
            <Folder className="group-data-[state=open]:hidden" />
            <FolderOpen className="group-data-[state=closed]:hidden" />
            <span className="truncate">{node.name}</span>
          </div>
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <SourceTreeNodes
          level={level + 1}
          nodes={node.children}
          onSelect={onSelect}
          value={value}
        />
      </CollapsibleContent>
    </Collapsible>
  );
}

function getSourceTreeNodes(items: ImportQueueItem[]): SourceTreeNode[] {
  if (items.length === 0) return [];

  const entries = items.map((item) => ({
    item,
    directories: getPathDirectories(formatSourcePath(item.snapshot.source.sourcePath)),
  }));

  const commonDepth = getCommonPathDepth(entries.map(({ directories }) => directories));

  const rootPath = entries[0]!.directories.slice(0, commonDepth).join("\\");

  const root: SourceTreeFolderNode = {
    id: `folder:${rootPath}`,
    name: rootPath,
    children: [],
  };

  for (const { directories, item } of entries) {
    let children = root.children;
    let currentPath = rootPath;

    for (const directory of directories.slice(commonDepth)) {
      currentPath = `${currentPath}\\${directory}`;

      let folder = children.find(
        (node): node is SourceTreeFolderNode =>
          "children" in node && node.id === `folder:${currentPath}`,
      );

      if (!folder) {
        folder = {
          id: `folder:${currentPath}`,
          name: directory,
          children: [],
        };

        children.push(folder);
      }

      children = folder.children;
    }

    children.push({
      ...item.snapshot,
      id: item.id,
    });
  }

  return [root];
}

function getPathDirectories(path: string) {
  return path.split(/[\\/]/).slice(0, -1);
}

function getCommonPathDepth(paths: string[][]) {
  const first = paths[0];
  if (!first) return 0;

  let depth = 0;

  while (depth < first.length && paths.every((path) => path[depth] === first[depth])) {
    depth++;
  }

  return depth;
}

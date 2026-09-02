import {
  ChevronRightIcon,
  FileVideo,
  Folder,
  FolderOpen,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  selectActiveInstanceId,
  selectEditingInstances,
} from "@/app/store/slices/editing-instances-slice";
import {
  closeActiveEditingInstanceRequested,
  deleteActiveEditingInstanceSourceRequested,
  navigateToEditingInstance,
  restoreSourceFileRequested,
} from "@/app/store/thunks/source-media-thunks";
import type { EditingInstance } from "@/domain/editing-instance";

import { SourceDetails } from "./components/SourceDetails";
import { formatSourcePath } from "./lib/media-formatters.utils";

type SourceTreeNode =
  | { children: SourceTreeNode[]; id: string; kind: "folder"; name: string }
  | { instance: EditingInstance; kind: "instance" };

type SourceTreeActions = {
  onClose: (id: string) => void;
  onDelete: (id: string) => void;
  onRestore: (sourcePath: string) => void;
  onSelect: (id: string) => void;
  value: string;
};

export function SourceTree() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const instances = useAppSelector(selectEditingInstances);
  const activeInstanceId = useAppSelector(selectActiveInstanceId);

  return (
    <aside aria-label={t("source.labels.title")} className="flex size-full min-h-0 flex-col pt-3">
      <h3
        className="mx-3 font-heading text-xs font-bold tracking-[0.16em] text-primary uppercase"
        id="source-panel-title"
      >
        {t("source.labels.title")}
      </h3>

      <section
        aria-labelledby="source-details-title"
        className="min-h-0 overflow-auto px-3 pt-2"
        id="workspace-sidebar-source-details"
      >
        <h4 className="sr-only">{t("source.labels.mediaDetails")}</h4>
        <SourceDetails />
      </section>

      <Separator className="bg-foreground/10" />

      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-1 p-1">
          <SourceTreeNodes
            nodes={getSourceTreeNodes(instances)}
            onClose={(id) => void dispatch(closeActiveEditingInstanceRequested(id))}
            onDelete={(id) => void dispatch(deleteActiveEditingInstanceSourceRequested(id))}
            onRestore={(path) => void dispatch(restoreSourceFileRequested({ sourcePath: path }))}
            onSelect={(id) => void dispatch(navigateToEditingInstance(id))}
            value={activeInstanceId ?? ""}
          />
        </div>
      </ScrollArea>
    </aside>
  );
}

function SourceTreeNodes({
  level = 0,
  nodes,
  onClose,
  onDelete,
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
        onDelete={onDelete}
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
        onDelete={onDelete}
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
  return (
    <Collapsible className="w-full">
      <CollapsibleTrigger asChild>
        <Button
          className="group w-full min-w-0 justify-start data-open:bg-transparent"
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
        </Button>
      </CollapsibleTrigger>
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
  onDelete,
  onRestore,
  onSelect,
  selected,
}: {
  instance: EditingInstance;
  level: number;
  onClose: (id: string) => void;
  onDelete: (id: string) => void;
  onRestore: (sourcePath: string) => void;
  onSelect: (id: string) => void;
  selected: boolean;
}) {
  const attempt = instance.exportAttempts.at(-1);
  const status =
    instance.sourceAvailability === "deleted" ? "deleted" : (attempt?.state.status ?? "ready");

  const statusLabel =
    status === "completed" && attempt?.state.status === "completed"
      ? `completed · ${attempt.state.result.displayName}`
      : status;

  return (
    <div
      className="group group-line relative flex min-w-0 items-center gap-1 rounded-md pr-1"
      data-open={selected}
    >
      <Button
        className="min-w-0 flex-1 justify-between overflow-hidden text-muted-foreground! transition-none group-focus-within:pr-4 group-focus-within:text-foreground! group-hover:bg-muted group-hover:pr-4 group-hover:text-foreground! dark:group-hover:bg-muted/50"
        onClick={() => onSelect(instance.id)}
        size="xs"
        variant="ghost"
      >
        <span className="flex min-w-0 items-center gap-1" style={{ paddingLeft: level * 8 + 16 }}>
          <FileVideo className="shrink-0" />
          <span className="truncate">{instance.snapshot.source.displayName}</span>
        </span>

        <span
          className="shrink-0 text-[10px] text-muted-foreground group-focus-within:invisible group-hover:invisible"
          title={statusLabel}
        >
          {statusLabel}
        </span>
      </Button>

      <ButtonGroup className="invisible absolute right-0 group-focus-within:visible group-hover:visible">
        <Button
          aria-label="Close editing instance"
          className="transition-none"
          onClick={() => onClose(instance.id)}
          size="icon-xs"
          type="button"
          variant="secondary"
        >
          <X aria-hidden="true" />
        </Button>

        {instance.sourceAvailability === "deleted" ? (
          <Button
            aria-label="Restore source"
            className="transition-none"
            onClick={() => onRestore(instance.snapshot.source.sourcePath)}
            size="icon-xs"
            type="button"
            variant="success"
          >
            <RotateCcw aria-hidden="true" />
          </Button>
        ) : (
          <Button
            aria-label="Delete source"
            className="transition-none"
            onClick={() => onDelete(instance.id)}
            size="icon-xs"
            type="button"
            variant="destructive"
          >
            <Trash2 aria-hidden="true" />
          </Button>
        )}
      </ButtonGroup>
    </div>
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

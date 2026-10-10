import { ChevronRight, GripVertical } from "lucide-react";
import { Fragment, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelControl,
  ResizablePanelGroup,
} from "@/components/ui/resizable";

import { SidebarViewTarget } from "@/app/layout/components/SidebarViewPortal";
import {
  isSidebarViewId,
  type SidebarId,
  type SidebarViewId,
} from "@/app/layout/lib/sidebar-layout";
import type { SidebarViewHosts } from "@/app/layout/lib/sidebar-view-hosts";
import { cn } from "@/lib/class-names.utils";

interface SidebarDropPreview {
  index: number;
  offset: number;
  side: SidebarId;
}

interface AppLayoutSidebarProps {
  draggedViewId: SidebarViewId | null;
  dropPreview: SidebarDropPreview | null;
  hosts: SidebarViewHosts;
  onDragEnd: () => void;
  onDragStart: (viewId: SidebarViewId, dataTransfer: DataTransfer) => void;
  onDrop: (viewId: SidebarViewId, side: SidebarId, index: number) => void;
  onPreview: (preview: SidebarDropPreview | null) => void;
  side: SidebarId;
  views: SidebarViewId[];
}

const VIEW_PANEL_IDS: Record<SidebarViewId, string> = {
  activity: "editor-source-activity-feed",
  sources: "editor-source-imported-sources",
};

function getSidebarInsertionIndex(
  sidebar: HTMLElement,
  viewId: SidebarViewId,
  clientY: number,
): number {
  const items = Array.from(sidebar.querySelectorAll<HTMLElement>("[data-sidebar-view]")).filter(
    (item) => item.dataset.sidebarView !== viewId,
  );

  const targetIndex = items.findIndex((item) => {
    const bounds = item.getBoundingClientRect();
    return clientY < bounds.top + bounds.height / 2;
  });

  return targetIndex < 0 ? items.length : targetIndex;
}

function AppLayoutSidebar({
  draggedViewId,
  dropPreview,
  hosts,
  onDragEnd,
  onDragStart,
  onDrop,
  onPreview,
  side,
  views,
}: AppLayoutSidebarProps) {
  const { t } = useTranslation();
  const sidebarRef = useRef<HTMLElement>(null);

  const handleDragOver = useCallback(
    (event: React.DragEvent<HTMLElement>) => {
      if (!draggedViewId) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      const sidebar = sidebarRef.current;
      if (!sidebar) return;

      const items = Array.from(sidebar.querySelectorAll<HTMLElement>("[data-sidebar-view]")).filter(
        (item) => item.dataset.sidebarView !== draggedViewId,
      );

      const targetIndex = items.findIndex((item) => {
        const bounds = item.getBoundingClientRect();
        return event.clientY < bounds.top + bounds.height / 2;
      });

      const index = targetIndex < 0 ? items.length : targetIndex;
      const sidebarTop = sidebar.getBoundingClientRect().top;
      const offset =
        targetIndex >= 0
          ? items[targetIndex]!.getBoundingClientRect().top - sidebarTop
          : items.length > 0
            ? items[items.length - 1]!.getBoundingClientRect().bottom - sidebarTop
            : 0;

      onPreview({ index, offset, side });
    },
    [draggedViewId, onPreview, side],
  );

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLElement>) => {
      event.preventDefault();
      const sidebar = sidebarRef.current;
      const transferredViewId = event.dataTransfer.getData("text/plain");
      const viewId = draggedViewId ?? transferredViewId;
      if (!sidebar || !isSidebarViewId(viewId)) return;

      const insertionIndex =
        dropPreview?.side === side
          ? dropPreview.index
          : getSidebarInsertionIndex(sidebar, viewId, event.clientY);

      onDrop(viewId, side, insertionIndex);
    },
    [draggedViewId, dropPreview, onDrop, side],
  );

  if (views.length === 0) return null;

  return (
    <aside
      aria-label={side === "left" ? t("layout.leftSidebar") : t("layout.rightSidebar")}
      className={cn(
        "relative flex size-full min-h-0 min-w-0 flex-col overflow-hidden p-1.5",
        dropPreview?.side === side && "rounded-lg bg-primary/5 ring-1 ring-primary/35",
      )}
      data-sidebar-region={side}
      onDragLeave={(event) => {
        const nextTarget = event.relatedTarget;
        if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
          onPreview(null);
        }
      }}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      ref={sidebarRef}
    >
      {views.length === 1 ? (
        <SidebarViewFrame
          draggedViewId={draggedViewId}
          host={hosts[views[0]!]}
          onDragEnd={onDragEnd}
          onDragStart={onDragStart}
          viewId={views[0]!}
        />
      ) : (
        <ResizablePanelGroup
          className="*:data-panel:transition-[flex-grow,flex-basis] *:data-panel:duration-200 *:data-panel:ease-out has-data-[separator=active]:*:data-panel:transition-none motion-reduce:*:data-panel:transition-none"
          id={side === "left" ? "editor-source" : "editor-right-sidebar"}
          key={`${side}:${views.join(":")}`}
          orientation="vertical"
          persisted
        >
          {views.map((viewId, index) => (
            <Fragment key={viewId}>
              {index > 0 && (
                <ResizableHandle className="bg-transparent px-3">
                  <div className="h-px w-full bg-border" />
                </ResizableHandle>
              )}
              <ResizablePanel
                className={cn(
                  "flex min-h-0 flex-col overflow-hidden!",
                  draggedViewId === viewId && "opacity-60",
                )}
                collapsedSize="2.25rem"
                collapsible
                data-sidebar-view={viewId}
                defaultSize={viewId === "sources" ? "45" : "30"}
                id={VIEW_PANEL_IDS[viewId]}
                minSize={viewId === "sources" ? "18.75rem" : "12.5rem"}
              >
                <SidebarViewHeader
                  collapsible
                  dragged={draggedViewId === viewId}
                  onDragEnd={onDragEnd}
                  onDragStart={onDragStart}
                  viewId={viewId}
                />
                <SidebarViewTarget host={hosts[viewId]} />
              </ResizablePanel>
            </Fragment>
          ))}
        </ResizablePanelGroup>
      )}

      {dropPreview?.side === side ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-3 z-30 h-0.5 rounded-full bg-primary shadow-[0_0_0.5rem_var(--primary)]"
          style={{ top: `${dropPreview.offset}px` }}
        />
      ) : null}
    </aside>
  );
}

function SidebarViewFrame({
  draggedViewId,
  host,
  onDragEnd,
  onDragStart,
  viewId,
}: {
  draggedViewId: SidebarViewId | null;
  host: HTMLDivElement;
  onDragEnd: () => void;
  onDragStart: AppLayoutSidebarProps["onDragStart"];
  viewId: SidebarViewId;
}) {
  return (
    <div
      className={cn(
        "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden",
        draggedViewId === viewId && "opacity-60",
      )}
      data-sidebar-view={viewId}
    >
      <SidebarViewHeader
        collapsible={false}
        dragged={draggedViewId === viewId}
        onDragEnd={onDragEnd}
        onDragStart={onDragStart}
        viewId={viewId}
      />
      <SidebarViewTarget host={host} />
    </div>
  );
}

function SidebarViewHeader({
  collapsible,
  dragged,
  onDragEnd,
  onDragStart,
  viewId,
}: {
  collapsible: boolean;
  dragged: boolean;
  onDragEnd: () => void;
  onDragStart: AppLayoutSidebarProps["onDragStart"];
  viewId: SidebarViewId;
}) {
  const { t } = useTranslation();
  const title = viewId === "sources" ? t("source.importedSources") : t("layout.activityFeed");
  const collapseLabel =
    viewId === "sources"
      ? t("layout.collapseView", { view: t("source.importedSources") })
      : t("layout.collapseView", { view: t("layout.activityFeed") });

  const expandLabel =
    viewId === "sources"
      ? t("layout.expandView", { view: t("source.importedSources") })
      : t("layout.expandView", { view: t("layout.activityFeed") });

  const panelId = VIEW_PANEL_IDS[viewId];

  return (
    <div className="flex shrink-0 items-center gap-1 px-2 py-1">
      <button
        aria-label={t("layout.dragView", { view: title })}
        className="flex min-w-0 flex-1 cursor-grab items-center gap-2 rounded-md p-1 text-left text-secondary-foreground active:cursor-grabbing"
        data-dragging={dragged}
        draggable
        onDragEnd={onDragEnd}
        onDragStart={(event) => onDragStart(viewId, event.dataTransfer)}
        type="button"
      >
        <GripVertical aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
        <span className="truncate text-sm font-medium">{title}</span>
      </button>
      {collapsible ? (
        <ResizablePanelControl panelId={panelId}>
          {({ isExpanded }) => (
            <Button
              aria-label={isExpanded ? collapseLabel : expandLabel}
              className="size-7 shrink-0 p-0 text-secondary-foreground"
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <ChevronRight
                aria-hidden="true"
                className={cn("size-4 shrink-0 transition-transform", isExpanded && "rotate-90")}
              />
            </Button>
          )}
        </ResizablePanelControl>
      ) : null}
    </div>
  );
}

function SidebarEmptyDropTarget({
  draggedViewId,
  onDrop,
  onPreview,
  preview,
  side,
}: {
  draggedViewId: SidebarViewId | null;
  onDrop: (viewId: SidebarViewId, destination: SidebarId, index: number) => void;
  onPreview: (preview: SidebarDropPreview | null) => void;
  preview: SidebarDropPreview | null;
  side: SidebarId;
}) {
  const { t } = useTranslation();
  const title = side === "left" ? t("layout.leftSidebar") : t("layout.rightSidebar");
  const isTarget = preview?.side === side;

  return (
    <div
      aria-label={title}
      className={cn(
        "absolute inset-y-2 z-40 flex w-56 flex-col items-center justify-center rounded-xl border-2 border-dashed bg-background/95 p-4 text-center text-sm text-muted-foreground shadow-xl backdrop-blur-sm",
        isTarget ? "border-primary bg-primary/10 text-foreground" : "border-primary/50",
        side === "left" ? "left-2" : "right-2",
      )}
      onDragLeave={(event) => {
        const nextTarget = event.relatedTarget;
        if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
          onPreview(null);
        }
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        onPreview({ index: 0, offset: 0, side });
      }}
      onDrop={(event) => {
        event.preventDefault();
        const transferredViewId = event.dataTransfer.getData("text/plain");
        const viewId = draggedViewId ?? transferredViewId;
        if (isSidebarViewId(viewId)) onDrop(viewId, side, 0);
      }}
      role="region"
    >
      <span>{t("layout.dropViewHere", { sidebar: title })}</span>
      {isTarget ? (
        <div aria-hidden="true" className="absolute inset-x-3 top-2 h-0.5 rounded bg-primary" />
      ) : null}
    </div>
  );
}

export { AppLayoutSidebar, SidebarEmptyDropTarget };
export type { SidebarDropPreview };

import { useDroppable } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import { ChevronRight, GripVertical } from "lucide-react";
import { Fragment } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelControl,
  ResizablePanelGroup,
} from "@/components/ui/resizable";

import { SidebarViewTarget } from "@/app/layout/components/SidebarViewPortal";
import type { SidebarId, SidebarViewId } from "@/app/layout/lib/sidebar-layout";
import type { SidebarViewHosts } from "@/app/layout/lib/sidebar-view-hosts";
import { cn } from "@/lib/class-names.utils";

interface AppLayoutSidebarProps {
  hosts: SidebarViewHosts;
  side: SidebarId;
  views: SidebarViewId[];
}

const VIEW_PANEL_IDS: Record<SidebarViewId, string> = {
  activity: "editor-source-activity-feed",
  sources: "editor-source-imported-sources",
};

const VIEW_PANEL_SIZES: Record<SidebarViewId, { defaultSize: string; minSize: string }> = {
  activity: { minSize: "12.5rem", defaultSize: "30" },
  sources: { minSize: "18.75rem", defaultSize: "45" },
};

function AppLayoutSidebar({ hosts, side, views }: AppLayoutSidebarProps) {
  const { t } = useTranslation();
  const { ref } = useDroppable({ accept: "sidebar-view", id: side, type: "sidebar-region" });

  if (views.length === 0) return null;

  return (
    <aside
      aria-label={side === "left" ? t("layout.leftSidebar") : t("layout.rightSidebar")}
      className="relative flex size-full min-h-0 min-w-0 flex-col overflow-hidden px-3"
      data-sidebar-region={side}
      ref={ref}
    >
      {views.length === 1 ? (
        <SidebarViewFrame
          collapsible={false}
          host={hosts[views[0]!]}
          index={0}
          side={side}
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
                <ResizableHandle className="bg-transparent">
                  <div className="h-px w-full bg-border" />
                </ResizableHandle>
              )}
              <ResizablePanel
                className="flex min-h-0 flex-col overflow-hidden!"
                collapsedSize="2.25rem"
                collapsible
                id={VIEW_PANEL_IDS[viewId]}
                {...VIEW_PANEL_SIZES[viewId]}
              >
                <SidebarViewFrame
                  collapsible
                  host={hosts[viewId]}
                  index={index}
                  side={side}
                  viewId={viewId}
                />
              </ResizablePanel>
            </Fragment>
          ))}
        </ResizablePanelGroup>
      )}
    </aside>
  );
}

function SidebarViewFrame({
  collapsible,
  host,
  index,
  side,
  viewId,
}: {
  collapsible: boolean;
  host: HTMLDivElement;
  index: number;
  side: SidebarId;
  viewId: SidebarViewId;
}) {
  const { handleRef, isDragging, isDropTarget, ref } = useSortable({
    accept: "sidebar-view",
    group: side,
    id: viewId,
    index,
    type: "sidebar-view",
  });

  return (
    <div
      className={cn(
        "flex size-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden",
        isDragging && "bg-card opacity-60",
        isDropTarget && "bg-primary/10 ring-1 ring-primary/50 ring-inset",
      )}
      data-sidebar-view={viewId}
      ref={ref}
    >
      <SidebarViewHeader collapsible={collapsible} handleRef={handleRef} viewId={viewId} />
      <SidebarViewTarget host={host} />
    </div>
  );
}

function SidebarViewHeader({
  collapsible,
  handleRef,
  viewId,
}: {
  collapsible: boolean;
  handleRef: (element: Element | null) => void;
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
    <div className="flex shrink-0 items-center gap-1 py-1">
      <button
        aria-label={t("layout.dragView", { view: title })}
        className="flex min-w-0 flex-1 cursor-grab items-center gap-2 rounded-md p-1 text-left text-secondary-foreground active:cursor-grabbing"
        ref={handleRef}
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

function SidebarEmptyDropTarget({ isDragging, side }: { isDragging: boolean; side: SidebarId }) {
  const { t } = useTranslation();
  const title = side === "left" ? t("layout.leftSidebar") : t("layout.rightSidebar");
  const { isDropTarget, ref } = useDroppable({
    accept: "sidebar-view",
    id: side,
    type: "sidebar-region",
  });

  return (
    <div
      aria-hidden={!isDragging}
      aria-label={title}
      className={cn(
        "absolute inset-y-0 z-40 flex w-2xs flex-col items-center justify-center rounded-xl border-2 border-dashed bg-background/10 p-4 text-center text-sm text-muted-foreground shadow-xl backdrop-blur-sm",
        isDragging
          ? "pointer-events-auto border-primary/50 opacity-100"
          : "pointer-events-none opacity-0",
        isDropTarget && "border-primary bg-primary/10 text-foreground",
        side === "left" ? "left-0 rounded-r-none" : "right-0 rounded-l-none",
      )}
      data-sidebar-empty-drop-target={side}
      ref={ref}
      role="region"
    >
      <span>{t("layout.dropViewHere", { sidebar: title })}</span>
    </div>
  );
}

export { AppLayoutSidebar, SidebarEmptyDropTarget };

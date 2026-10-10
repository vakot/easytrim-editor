import { Feedback } from "@dnd-kit/dom";
import { useDraggable, useDroppable } from "@dnd-kit/react";
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
import type {
  SidebarDropPlacement,
  SidebarId,
  SidebarViewId,
} from "@/app/layout/lib/sidebar-layout";
import type { SidebarViewHosts } from "@/app/layout/lib/sidebar-view-hosts";
import { cn } from "@/lib/class-names.utils";

interface AppLayoutSidebarProps {
  hosts: SidebarViewHosts;
  placement: SidebarDropPlacement | null;
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

function AppLayoutSidebar({ hosts, placement, side, views }: AppLayoutSidebarProps) {
  const { t } = useTranslation();
  const { ref } = useDroppable({ accept: "sidebar-view", id: side, type: "sidebar-region" });
  const previewViews = getPreviewViews(views, side, placement);

  if (previewViews.length === 0) return null;

  return (
    <aside
      aria-label={side === "left" ? t("layout.leftSidebar") : t("layout.rightSidebar")}
      className="relative flex size-full min-h-0 min-w-0 flex-col overflow-hidden px-3"
      data-sidebar-region={side}
      ref={ref}
    >
      {placement?.destination === side ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-5 z-30 h-12 -translate-y-1/2 rounded-lg border-2 border-dashed border-primary/60 bg-card/80 shadow-md"
          data-sidebar-drop-placeholder={side}
          data-sidebar-drop-placeholder-index={placement.insertionIndex}
          style={{ top: placement.previewTop }}
        />
      ) : null}
      {previewViews.length === 1 ? (
        <SidebarViewStandalone
          collapsible={false}
          host={hosts[previewViews[0]!]}
          viewId={previewViews[0]!}
        />
      ) : (
        <ResizablePanelGroup
          className="*:data-panel:transition-[flex-grow,flex-basis] *:data-panel:duration-200 *:data-panel:ease-out has-data-[separator=active]:*:data-panel:transition-none motion-reduce:*:data-panel:transition-none"
          id={side === "left" ? "editor-source" : "editor-right-sidebar"}
          orientation="vertical"
          persisted
        >
          {previewViews.map((viewId, index) => (
            <Fragment key={viewId}>
              {index > 0 && (
                <ResizableHandle className="bg-transparent">
                  <div className="h-px w-full bg-border" />
                </ResizableHandle>
              )}
              <SidebarViewPanel collapsible host={hosts[viewId]} viewId={viewId} />
            </Fragment>
          ))}
        </ResizablePanelGroup>
      )}
    </aside>
  );
}

function SidebarViewPanel({
  collapsible,
  host,
  viewId,
}: {
  collapsible: boolean;
  host: HTMLDivElement;
  viewId: SidebarViewId;
}) {
  const draggable = useSidebarDraggable(viewId);

  return (
    <ResizablePanel
      className="flex min-h-0 flex-col overflow-hidden!"
      collapsedSize="2.25rem"
      collapsible
      elementRef={draggable.ref}
      id={VIEW_PANEL_IDS[viewId]}
      {...VIEW_PANEL_SIZES[viewId]}
    >
      <SidebarViewFrame
        collapsible={collapsible}
        draggable={draggable}
        host={host}
        viewId={viewId}
      />
    </ResizablePanel>
  );
}

function SidebarViewStandalone({
  collapsible,
  host,
  viewId,
}: {
  collapsible: boolean;
  host: HTMLDivElement;
  viewId: SidebarViewId;
}) {
  const draggable = useSidebarDraggable(viewId);

  return (
    <SidebarViewFrame collapsible={collapsible} draggable={draggable} host={host} viewId={viewId} />
  );
}

function SidebarViewFrame({
  collapsible,
  draggable,
  host,
  viewId,
}: {
  collapsible: boolean;
  draggable: ReturnType<typeof useSidebarDraggable>;
  host: HTMLDivElement;
  viewId: SidebarViewId;
}) {
  return (
    <div
      className={cn(
        "flex size-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden",
        draggable.isDragging && "bg-card opacity-60",
      )}
      data-sidebar-view={viewId}
    >
      <SidebarViewHeader
        collapsible={collapsible}
        handleRef={draggable.handleRef}
        viewId={viewId}
      />
      <SidebarViewTarget host={host} />
    </div>
  );
}

function useSidebarDraggable(viewId: SidebarViewId) {
  return useDraggable({
    id: viewId,
    // The default feedback inserts a copied panel sibling into ResizablePanelGroup.
    // React owns the preview order, so suppress DnD's structural placeholder and transform.
    plugins: [Feedback.configure({ feedback: "none" })],
    type: "sidebar-view",
  });
}

function getPreviewViews(
  views: SidebarViewId[],
  side: SidebarId,
  placement: SidebarDropPlacement | null,
): SidebarViewId[] {
  if (placement?.destination !== side) return views;

  const sourceIndex = views.indexOf(placement.viewId);
  if (sourceIndex < 0) return views;

  const previewViews = [...views];
  previewViews.splice(sourceIndex, 1);
  previewViews.splice(placement.insertionIndex, 0, placement.viewId);
  return previewViews;
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

import { Feedback } from "@dnd-kit/dom";
import { useDraggable, useDroppable } from "@dnd-kit/react";
import { ChevronRight, GripVertical } from "lucide-react";
import { Fragment } from "react";
import { createPortal } from "react-dom";
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
      {previewViews.length === 1 &&
      placement?.destination === side &&
      !views.includes(placement.viewId) ? (
        <SidebarStandaloneDropPreview
          hosts={hosts}
          placement={placement}
          side={side}
          viewId={previewViews[0]!}
        />
      ) : previewViews.length === 1 ? (
        <SidebarViewStandalone
          collapsible={false}
          host={hosts[previewViews[0]!]}
          side={side}
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
              <SidebarViewPanel
                collapsible
                host={hosts[viewId]}
                placeholder={
                  placement?.destination === side && placement.viewId === viewId ? placement : null
                }
                side={side}
                viewId={viewId}
              />
            </Fragment>
          ))}
        </ResizablePanelGroup>
      )}
    </aside>
  );
}

function SidebarStandaloneDropPreview({
  hosts,
  placement,
  side,
  viewId,
}: {
  hosts: SidebarViewHosts;
  placement: SidebarDropPlacement;
  side: SidebarId;
  viewId: SidebarViewId;
}) {
  const incomingWeight = Number(VIEW_PANEL_SIZES[placement.viewId].defaultSize);
  const currentWeight = Number(VIEW_PANEL_SIZES[viewId].defaultSize);
  const placeholder = (
    <div
      className="flex min-h-0 min-w-0 transition-[flex-grow,flex-basis] duration-200 ease-out motion-reduce:transition-none"
      style={{ flex: `${incomingWeight} 1 0%` }}
    >
      <SidebarDropPlaceholder className="size-full" placement={placement} side={side} />
    </div>
  );

  const existingView = (
    <div
      className="flex min-h-0 min-w-0 transition-[flex-grow,flex-basis] duration-200 ease-out motion-reduce:transition-none"
      style={{ flex: `${currentWeight} 1 0%` }}
    >
      <SidebarViewStandalone collapsible={false} host={hosts[viewId]} side={side} viewId={viewId} />
    </div>
  );

  return (
    <>
      {placement.insertionIndex === 0 ? placeholder : existingView}
      <div aria-hidden="true" className="h-px shrink-0 bg-border" />
      {placement.insertionIndex === 0 ? existingView : placeholder}
    </>
  );
}

function SidebarViewPanel({
  collapsible,
  host,
  placeholder,
  side,
  viewId,
}: {
  collapsible: boolean;
  host: HTMLDivElement;
  placeholder: SidebarDropPlacement | null;
  side: SidebarId;
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
        placeholder={placeholder}
        side={side}
        viewId={viewId}
      />
    </ResizablePanel>
  );
}

function SidebarViewStandalone({
  collapsible,
  host,
  side,
  viewId,
}: {
  collapsible: boolean;
  host: HTMLDivElement;
  side: SidebarId;
  viewId: SidebarViewId;
}) {
  const draggable = useSidebarDraggable(viewId);

  return (
    <SidebarViewFrame
      collapsible={collapsible}
      draggable={draggable}
      host={host}
      placeholder={null}
      side={side}
      viewId={viewId}
    />
  );
}

function SidebarViewFrame({
  collapsible,
  draggable,
  host,
  placeholder,
  side,
  viewId,
}: {
  collapsible: boolean;
  draggable: ReturnType<typeof useSidebarDraggable>;
  host: HTMLDivElement;
  placeholder?: SidebarDropPlacement | null;
  side: SidebarId;
  viewId: SidebarViewId;
}) {
  const isDropPlaceholder = placeholder !== null && placeholder !== undefined;

  return (
    <div
      className={cn(
        "relative flex size-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden transition-[background-color,opacity] duration-150 motion-reduce:transition-none",
        draggable.isDragging && !isDropPlaceholder && "bg-card opacity-50",
      )}
      data-sidebar-view={viewId}
    >
      {isDropPlaceholder ? (
        <SidebarDropPlaceholder
          className="absolute inset-0 z-20"
          placement={placeholder}
          side={side}
        />
      ) : null}
      <div
        className={cn(
          "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden",
          isDropPlaceholder && "invisible",
        )}
      >
        <SidebarViewHeader
          collapsible={collapsible}
          handleRef={draggable.handleRef}
          viewId={viewId}
        />
        <SidebarViewTarget host={host} />
      </div>
    </div>
  );
}

function SidebarDropPlaceholder({
  className,
  placement,
  side,
}: {
  className?: string;
  placement: SidebarDropPlacement;
  side: SidebarId;
}) {
  const { t } = useTranslation();
  const title =
    placement.viewId === "sources" ? t("source.importedSources") : t("layout.activityFeed");

  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none flex min-h-0 min-w-0 flex-col rounded-lg border-2 border-dashed border-primary/60 bg-primary/5 p-1.5 text-secondary-foreground shadow-sm transition-[background-color,border-color] duration-150",
        className,
      )}
      data-sidebar-drop-placeholder={side}
      data-sidebar-drop-placeholder-index={placement.insertionIndex}
    >
      <div className="flex min-h-0 items-center gap-1">
        <GripVertical aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
        <span className="truncate text-sm font-medium">{title}</span>
      </div>
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

function SidebarDragPreview({
  position,
  viewId,
}: {
  position: { x: number; y: number };
  viewId: SidebarViewId;
}) {
  const { t } = useTranslation();
  const title = viewId === "sources" ? t("source.importedSources") : t("layout.activityFeed");

  return createPortal(
    <div
      aria-hidden="true"
      className="pointer-events-none fixed z-100 inline-flex max-w-64 items-center gap-2 rounded-lg border border-border bg-card/95 px-3 py-2 text-sm font-medium text-secondary-foreground opacity-95 shadow-xl backdrop-blur-sm"
      data-sidebar-drag-preview={viewId}
      style={{ left: position.x, top: position.y, transform: "translate(12px, 12px)" }}
    >
      <GripVertical aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
      <span className="truncate">{title}</span>
    </div>,
    document.body,
  );
}

export { AppLayoutSidebar, SidebarDragPreview, SidebarEmptyDropTarget };

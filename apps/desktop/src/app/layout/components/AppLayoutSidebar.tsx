import {
  Feedback,
  KeyboardSensor,
  PointerActivationConstraints,
  PointerSensor,
} from "@dnd-kit/dom";
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
  draggingViewId: SidebarViewId | null;
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

const SIDEBAR_DRAG_SENSORS = [
  PointerSensor.configure({
    activationConstraints: [new PointerActivationConstraints.Distance({ value: 6 })],
  }),
  KeyboardSensor,
];

function AppLayoutSidebar({
  draggingViewId,
  hosts,
  placement,
  side,
  views,
}: AppLayoutSidebarProps) {
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
      {placement?.destination === side ? (
        <SidebarInsertionIndicator placement={placement} side={side} />
      ) : null}
      {views.length === 1 ? (
        <SidebarViewStandalone
          collapsible={false}
          host={hosts[views[0]!]}
          isDragging={draggingViewId === views[0]}
          viewId={views[0]!}
        />
      ) : (
        <ResizablePanelGroup
          className="*:data-panel:transition-[flex-grow,flex-basis] *:data-panel:duration-200 *:data-panel:ease-out has-data-[separator=active]:*:data-panel:transition-none motion-reduce:*:data-panel:transition-none"
          id={side === "left" ? "editor-source" : "editor-right-sidebar"}
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
              <SidebarViewPanel
                collapsible
                host={hosts[viewId]}
                isDragging={draggingViewId === viewId}
                viewId={viewId}
              />
            </Fragment>
          ))}
        </ResizablePanelGroup>
      )}
    </aside>
  );
}

function SidebarInsertionIndicator({
  placement,
  side,
}: {
  placement: SidebarDropPlacement;
  side: SidebarId;
}) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-3 z-40 h-1 -translate-y-1/2 bg-primary transition-[top] duration-150 motion-reduce:transition-none"
      data-sidebar-drop-indicator={side}
      data-sidebar-drop-indicator-index={placement.insertionIndex}
      style={{ top: placement.indicatorOffset }}
    />
  );
}

function SidebarViewPanel({
  collapsible,
  host,
  isDragging,
  viewId,
}: {
  collapsible: boolean;
  host: HTMLDivElement;
  isDragging: boolean;
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
        isDragging={isDragging}
        viewId={viewId}
      />
    </ResizablePanel>
  );
}

function SidebarViewStandalone({
  collapsible,
  host,
  isDragging,
  viewId,
}: {
  collapsible: boolean;
  host: HTMLDivElement;
  isDragging: boolean;
  viewId: SidebarViewId;
}) {
  const draggable = useSidebarDraggable(viewId);

  return (
    <SidebarViewFrame
      collapsible={collapsible}
      draggable={draggable}
      host={host}
      isDragging={isDragging}
      viewId={viewId}
    />
  );
}

function SidebarViewFrame({
  collapsible,
  draggable,
  host,
  isDragging,
  viewId,
}: {
  collapsible: boolean;
  draggable: ReturnType<typeof useSidebarDraggable>;
  host: HTMLDivElement;
  isDragging: boolean;
  viewId: SidebarViewId;
}) {
  return (
    <div
      className={cn(
        "relative flex size-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden transition-[background-color,opacity] duration-150 motion-reduce:transition-none",
        isDragging && "bg-card opacity-50",
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
    // AppLayout owns the visual preview, so suppress DnD's structural clone and transform.
    plugins: [Feedback.configure({ feedback: "none" })],
    sensors: SIDEBAR_DRAG_SENSORS,
    type: "sidebar-view",
  });
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

function SidebarEmptyDropTarget({
  isActive,
  isDragging,
  side,
}: {
  isActive: boolean;
  isDragging: boolean;
  side: SidebarId;
}) {
  const { ref } = useDroppable({
    accept: "sidebar-view",
    id: side,
    type: "sidebar-region",
  });

  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-y-0 z-40 w-[50vw]",
        side === "left" ? "left-0" : "right-0",
      )}
      data-sidebar-empty-drop-target={side}
      ref={ref}
    >
      {isDragging && isActive ? (
        <div
          className={cn(
            "absolute inset-y-0 w-1 bg-primary",
            side === "left" ? "left-82" : "right-82",
          )}
          data-sidebar-empty-drop-indicator={side}
        />
      ) : null}
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
      className="pointer-events-none fixed z-100 inline-flex max-w-64 items-center gap-2 rounded-lg border border-border bg-card/95 px-3 py-2 text-sm font-medium text-secondary-foreground opacity-75 shadow-xl backdrop-blur-sm"
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

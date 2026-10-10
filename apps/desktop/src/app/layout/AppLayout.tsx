import {
  DragDropProvider,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
  useDroppable,
} from "@dnd-kit/react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";

import { AppLayoutFooter } from "@/app/layout/components/AppLayoutFooter";
import { AppLayoutHeader } from "@/app/layout/components/AppLayoutHeader";
import { AppLayoutMain } from "@/app/layout/components/AppLayoutMain";
import { AppLayoutPanel } from "@/app/layout/components/AppLayoutPanel";
import {
  AppLayoutSidebar,
  SidebarDragPreview,
  SidebarEmptyDropTarget,
} from "@/app/layout/components/AppLayoutSidebar";
import { SidebarViewPortals } from "@/app/layout/components/SidebarViewPortal";
import {
  isSidebarId,
  isSidebarViewId,
  resolveSidebarDropPlacement,
  type SidebarDropPlacement,
  type SidebarId,
  type SidebarViewBounds,
  type SidebarViewId,
} from "@/app/layout/lib/sidebar-layout";
import { createSidebarViewHosts } from "@/app/layout/lib/sidebar-view-hosts";
import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  selectLayoutDensity,
  selectSidebarLayout,
  selectUiScalePercent,
  sidebarLayoutChanged,
} from "@/app/store/slices/preferences-slice";
import { cn } from "@/lib/class-names.utils";

import { useSidebarPresence, useSidebarVisibility } from "./hooks/useSidebarVisibility";

interface ActiveSidebarDragExpansion {
  collapsedAtStart: Set<SidebarId>;
  expandedByDrag: Set<SidebarId>;
  temporarilyExpanded: Set<SidebarId>;
}

const WORKSPACE_SIDEBAR_WIDTHS_STORAGE_KEY = "react-resizable-panels:workspace-sidebar-widths";

function AppLayout() {
  const dispatch = useAppDispatch();
  const layoutDensity = useAppSelector(selectLayoutDensity);
  const sidebarLayout = useAppSelector(selectSidebarLayout);
  const uiScalePercent = useAppSelector(selectUiScalePercent);
  const {
    hasLeftSidebar,
    hasRightSidebar,
    isSidebarCollapsed,
    leftSidebarVisible,
    resizeSidebar,
    rightSidebarVisible,
    setSidebarExpanded,
  } = useSidebarVisibility();

  const [viewHosts] = useState(createSidebarViewHosts);
  const [isDraggingView, setIsDraggingView] = useState(false);
  const [dropPlacement, setDropPlacement] = useState<SidebarDropPlacement | null>(null);
  const [dragPreview, setDragPreview] = useState<{
    position: { x: number; y: number };
    viewId: SidebarViewId;
  } | null>(null);

  const [workspaceSidebarWidths, setWorkspaceSidebarWidths] = useState<
    Partial<Record<SidebarId, string>>
  >(getSavedWorkspaceSidebarWidths);

  const leftSidebarPresence = useSidebarPresence("left", hasLeftSidebar);
  const rightSidebarPresence = useSidebarPresence("right", hasRightSidebar);

  const dragStartPanelBounds = useRef<Map<SidebarViewId, SidebarViewBounds>>(new Map());
  const dragStartRegionTops = useRef<Map<SidebarId, number>>(new Map());
  const dragSidebarExpansion = useRef<ActiveSidebarDragExpansion | null>(null);
  const workspaceSidebarWidthsRef = useRef(workspaceSidebarWidths);
  const resizeSidebarRef = useRef(resizeSidebar);
  const previousSidebarPresence = useRef({ left: hasLeftSidebar, right: hasRightSidebar });

  useEffect(() => {
    resizeSidebarRef.current = resizeSidebar;
  }, [resizeSidebar]);

  useEffect(() => {
    const wasPresent = previousSidebarPresence.current;
    previousSidebarPresence.current = { left: hasLeftSidebar, right: hasRightSidebar };

    const sidebarWasAdded =
      (!wasPresent.left && hasLeftSidebar) || (!wasPresent.right && hasRightSidebar);

    if (!sidebarWasAdded) return;

    const frame = window.requestAnimationFrame(() => {
      for (const side of ["left", "right"] as const) {
        const isPresent = side === "left" ? hasLeftSidebar : hasRightSidebar;
        const width = Number.parseFloat(workspaceSidebarWidthsRef.current[side] ?? "");
        if (isPresent && Number.isFinite(width) && width > 0) {
          resizeSidebarRef.current(side, width);
        }
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [hasLeftSidebar, hasRightSidebar]);

  const isCompact = layoutDensity === "compact";

  const handleWorkspaceLayoutChanged = useCallback(
    (layout: Record<string, number>, meta: { isUserInteraction: boolean }) => {
      const workspace = document.getElementById("workspace");
      if (!workspace) return;

      const separatorWidth = Array.from(
        workspace.querySelectorAll<HTMLElement>(":scope > [data-separator]"),
      ).reduce((total, separator) => total + separator.getBoundingClientRect().width, 0);

      const availableWidth = workspace.getBoundingClientRect().width - separatorWidth;
      if (availableWidth <= 0) return;

      const nextWidths = { ...workspaceSidebarWidthsRef.current };
      let hasChanged = false;
      for (const side of ["left", "right"] as const) {
        const panelId = side === "left" ? "workspace-left-sidebar" : "workspace-right-sidebar";
        const panelSize = layout[panelId];
        if (panelSize === undefined || panelSize <= 0) continue;

        if (!meta.isUserInteraction && nextWidths[side]) continue;
        const measuredWidth = document.getElementById(panelId)?.getBoundingClientRect().width;
        const sidebarWidth = measuredWidth || (availableWidth * panelSize) / 100;
        const width = `${sidebarWidth}px`;
        const currentWidth = Number.parseFloat(nextWidths[side] ?? "");
        if (
          meta.isUserInteraction &&
          (!Number.isFinite(currentWidth) || Math.abs(currentWidth - sidebarWidth) > 0.5)
        ) {
          const savedWidths = readSavedWorkspaceSidebarWidths();
          savedWidths[side] = sidebarWidth;
          try {
            localStorage.setItem(WORKSPACE_SIDEBAR_WIDTHS_STORAGE_KEY, JSON.stringify(savedWidths));
          } catch {
            // Resizing remains available when browser storage cannot be written.
          }
        }

        if (nextWidths[side] !== width) {
          nextWidths[side] = width;
          hasChanged = true;
        }
      }

      if (hasChanged) {
        workspaceSidebarWidthsRef.current = nextWidths;
        setWorkspaceSidebarWidths(nextWidths);
      }
    },
    [],
  );

  const updateDragSidebarExpansion = useCallback(
    (position: { x: number; y: number } | undefined) => {
      const expansion = dragSidebarExpansion.current;
      if (!expansion) return;

      const proximitySide = getSidebarProximitySide(position);
      for (const side of expansion.temporarilyExpanded) {
        if (side === proximitySide) continue;

        setSidebarExpanded(side, false);
        expansion.temporarilyExpanded.delete(side);
      }

      const sideHasPanels =
        proximitySide === "left"
          ? hasLeftSidebar
          : proximitySide === "right"
            ? hasRightSidebar
            : false;

      if (
        proximitySide &&
        sideHasPanels &&
        expansion.collapsedAtStart.has(proximitySide) &&
        !expansion.temporarilyExpanded.has(proximitySide)
      ) {
        setSidebarExpanded(proximitySide, true);
        expansion.temporarilyExpanded.add(proximitySide);
        expansion.expandedByDrag.add(proximitySide);
      }
    },
    [hasLeftSidebar, hasRightSidebar, setSidebarExpanded],
  );

  const getDropPlacement = useCallback(
    (event: DragMoveEvent | DragEndEvent) => {
      const viewId = event.operation.source?.id;
      if (!isSidebarViewId(viewId)) {
        return null;
      }

      const position = getDragPosition(event);
      if (!position) return null;

      const expansion = dragSidebarExpansion.current;
      const proximitySide = getSidebarProximitySide(position);
      const autoExpandedDestination =
        proximitySide && expansion?.temporarilyExpanded.has(proximitySide) ? proximitySide : null;

      const containsPointer = (element: HTMLElement) => {
        const bounds = element.getBoundingClientRect();
        return (
          position.x >= bounds.left &&
          position.x <= bounds.right &&
          position.y >= bounds.top &&
          position.y <= bounds.bottom
        );
      };

      const emptyTarget = Array.from(
        document.querySelectorAll<HTMLElement>("[data-sidebar-empty-drop-target]"),
      ).find(containsPointer);

      const emptyTargetSide = emptyTarget?.dataset.sidebarEmptyDropTarget;
      const usesEmptyTarget = !autoExpandedDestination && isSidebarId(emptyTargetSide);

      const populatedRegion = autoExpandedDestination
        ? document.querySelector<HTMLElement>(`[data-sidebar-region="${autoExpandedDestination}"]`)
        : Array.from(document.querySelectorAll<HTMLElement>("[data-sidebar-region]")).find(
            containsPointer,
          );

      const destination = autoExpandedDestination
        ? autoExpandedDestination
        : usesEmptyTarget
          ? emptyTargetSide
          : populatedRegion?.dataset.sidebarRegion;

      if (!isSidebarId(destination)) return null;

      const regionElement = usesEmptyTarget ? emptyTarget : populatedRegion;

      if (!regionElement) return null;

      const destinationBounds: SidebarViewBounds[] = sidebarLayout[destination]
        .filter((item) => item !== viewId)
        .flatMap((item) => {
          const bounds = dragStartPanelBounds.current.get(item);
          return bounds ? [bounds] : [];
        });

      const regionTop = usesEmptyTarget
        ? regionElement.getBoundingClientRect().top
        : (dragStartRegionTops.current.get(destination) ??
          regionElement.getBoundingClientRect().top);

      return resolveSidebarDropPlacement(
        sidebarLayout,
        viewId,
        destination,
        position.y,
        destinationBounds,
        regionTop,
      );
    },
    [sidebarLayout],
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      dragSidebarExpansion.current = {
        collapsedAtStart: new Set([
          ...(hasLeftSidebar && isSidebarCollapsed("left") ? ["left" as const] : []),
          ...(hasRightSidebar && isSidebarCollapsed("right") ? ["right" as const] : []),
        ]),
        expandedByDrag: new Set(),
        temporarilyExpanded: new Set(),
      };
      dragStartPanelBounds.current = new Map(
        Array.from(document.querySelectorAll<HTMLElement>("[data-sidebar-view]")).flatMap(
          (viewElement) => {
            const viewId = viewElement.dataset.sidebarView;
            const panel = viewElement.closest<HTMLElement>('[data-slot="resizable-panel"]');
            if (!isSidebarViewId(viewId) || !panel) return [];

            const bounds = panel.getBoundingClientRect();
            return [[viewId, { bottom: bounds.bottom, top: bounds.top, viewId }]] as const;
          },
        ),
      );
      dragStartRegionTops.current = new Map(
        Array.from(document.querySelectorAll<HTMLElement>("[data-sidebar-region]")).flatMap(
          (region) => {
            const side = region.dataset.sidebarRegion;
            if (!isSidebarId(side)) return [];
            return [[side, region.getBoundingClientRect().top]] as const;
          },
        ),
      );
      setDragPreview(getSidebarDragPreview(event));
      setIsDraggingView(true);
    },
    [hasLeftSidebar, hasRightSidebar, isSidebarCollapsed],
  );

  const handleDragMove = useCallback(
    (event: DragMoveEvent) => {
      updateDragSidebarExpansion(getDragPosition(event));
      setDropPlacement(getDropPlacement(event));
      setDragPreview(getSidebarDragPreview(event));
    },
    [getDropPlacement, updateDragSidebarExpansion],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      if (!event.canceled) updateDragSidebarExpansion(getDragPosition(event));
      const placement = event.canceled ? null : getDropPlacement(event);
      for (const side of dragSidebarExpansion.current?.expandedByDrag ?? []) {
        setSidebarExpanded(side, placement?.destination === side);
      }
      dragSidebarExpansion.current = null;
      setDropPlacement(null);
      setDragPreview(null);
      setIsDraggingView(false);
      dragStartPanelBounds.current.clear();
      dragStartRegionTops.current.clear();
      if (placement) {
        dispatch(
          sidebarLayoutChanged({
            destination: placement.destination,
            insertionIndex: placement.insertionIndex,
            viewId: placement.viewId,
          }),
        );
      }
    },
    [dispatch, getDropPlacement, setSidebarExpanded, updateDragSidebarExpansion],
  );

  useLayoutEffect(() => {
    const root = document.documentElement;
    const previousFontSize = root.style.fontSize;
    root.style.fontSize = `${uiScalePercent}%`;
    return () => {
      root.style.fontSize = previousFontSize;
    };
  }, [uiScalePercent]);

  return (
    <DragDropProvider
      onDragEnd={handleDragEnd}
      onDragMove={handleDragMove}
      onDragStart={handleDragStart}
    >
      <main className="fixed inset-0 grid h-dvh w-screen grid-rows-[2.25rem_minmax(0,1fr)_auto] overflow-hidden bg-background">
        <AppLayoutHeader />

        <div className="relative min-h-0 min-w-0">
          <ResizablePanelGroup
            className="*:data-panel:transition-[flex-grow,flex-basis] *:data-panel:duration-200 *:data-panel:ease-out has-data-[separator=active]:*:data-panel:transition-none motion-reduce:*:data-panel:transition-none"
            id="workspace"
            onLayoutChanged={handleWorkspaceLayoutChanged}
            onlySaveAfterUserInteractions
            persisted
          >
            {leftSidebarPresence.isMounted ? (
              <ResizablePanel
                className="ml-1.5 overflow-hidden!"
                collapsedSize={0}
                collapsible
                defaultSize={workspaceSidebarWidths.left ?? "20.5rem"}
                groupResizeBehavior="preserve-pixel-size"
                id="workspace-left-sidebar"
                maxSize="30rem"
                minSize="20.5rem"
              >
                <AppLayoutPanel className="min-w-xs layout-compact:rounded-l-xl layout-compact:border-y layout-compact:border-l">
                  <AppLayoutSidebar
                    draggingViewId={dragPreview?.viewId ?? null}
                    hosts={viewHosts}
                    placement={dropPlacement}
                    side="left"
                    views={sidebarLayout.left}
                  />
                </AppLayoutPanel>
              </ResizablePanel>
            ) : null}

            {leftSidebarPresence.isMounted ? (
              <AppLayoutSeparator
                isClosing={leftSidebarPresence.isClosing}
                isCollapsed={!leftSidebarVisible}
                isCompact={isCompact}
              />
            ) : null}

            <ResizablePanel
              className={cn(
                "overflow-hidden! transition-[margin] duration-200 ease-out motion-reduce:transition-none",
                !hasLeftSidebar && "ml-1.5",
                !hasRightSidebar && "mr-1.5",
              )}
              groupResizeBehavior="preserve-relative-size"
              id="workspace-content"
              minSize="50rem"
            >
              <div className="relative size-full min-h-0 min-w-0">
                <AppLayoutMain />
              </div>
            </ResizablePanel>

            {rightSidebarPresence.isMounted ? (
              <AppLayoutSeparator
                isClosing={rightSidebarPresence.isClosing}
                isCollapsed={!rightSidebarVisible}
                isCompact={isCompact}
              />
            ) : null}

            {rightSidebarPresence.isMounted ? (
              <ResizablePanel
                className="mr-1.5 overflow-hidden!"
                collapsedSize={0}
                collapsible
                defaultSize={workspaceSidebarWidths.right ?? "20.5rem"}
                groupResizeBehavior="preserve-pixel-size"
                id="workspace-right-sidebar"
                maxSize="30rem"
                minSize="20.5rem"
              >
                <AppLayoutPanel className="min-w-xs layout-compact:rounded-r-xl layout-compact:border-y layout-compact:border-r">
                  <AppLayoutSidebar
                    draggingViewId={dragPreview?.viewId ?? null}
                    hosts={viewHosts}
                    placement={dropPlacement}
                    side="right"
                    views={sidebarLayout.right}
                  />
                </AppLayoutPanel>
              </ResizablePanel>
            ) : null}
          </ResizablePanelGroup>

          {!hasLeftSidebar ? (
            <SidebarEmptyDropTarget
              isActive={dropPlacement?.destination === "left"}
              isDragging={isDraggingView}
              side="left"
            />
          ) : null}
          {!hasRightSidebar ? (
            <SidebarEmptyDropTarget
              isActive={dropPlacement?.destination === "right"}
              isDragging={isDraggingView}
              side="right"
            />
          ) : null}
        </div>

        <SidebarViewPortals hosts={viewHosts} />
        <SidebarDropSurface />
        <AppLayoutFooter />
        {dragPreview ? (
          <SidebarDragPreview position={dragPreview.position} viewId={dragPreview.viewId} />
        ) : null}
      </main>
    </DragDropProvider>
  );
}

function getDragPosition(event: DragStartEvent | DragMoveEvent | DragEndEvent) {
  return ("to" in event ? event.to : undefined) ?? event.operation.position.current;
}

function getSavedWorkspaceSidebarWidths(): Partial<Record<SidebarId, string>> {
  return Object.fromEntries(
    Object.entries(readSavedWorkspaceSidebarWidths()).map(([side, width]) => [side, `${width}px`]),
  ) as Partial<Record<SidebarId, string>>;
}

function readSavedWorkspaceSidebarWidths(): Partial<Record<SidebarId, number>> {
  try {
    const savedWidths = localStorage.getItem(WORKSPACE_SIDEBAR_WIDTHS_STORAGE_KEY);
    if (!savedWidths) return {};

    const parsed: unknown = JSON.parse(savedWidths);
    if (typeof parsed !== "object" || parsed === null) return {};

    const widths: Partial<Record<SidebarId, number>> = {};
    for (const side of ["left", "right"] as const) {
      const width = (parsed as Record<string, unknown>)[side];
      if (typeof width === "number" && Number.isFinite(width) && width > 0) {
        widths[side] = width;
      }
    }
    return widths;
  } catch {
    return {};
  }
}

function getSidebarDragPreview(event: DragStartEvent | DragMoveEvent) {
  const viewId = event.operation.source?.id;
  const position = getDragPosition(event);
  if (!isSidebarViewId(viewId) || !position) return null;

  return { position: { x: position.x, y: position.y }, viewId };
}

function getSidebarProximitySide(position: { x: number; y: number } | undefined) {
  const workspace = document.getElementById("workspace");
  if (!position || !workspace) return null;

  const bounds = workspace.getBoundingClientRect();
  if (
    position.x < bounds.left ||
    position.x > bounds.right ||
    position.y < bounds.top ||
    position.y > bounds.bottom
  ) {
    return null;
  }

  const rootFontSizeValue = getComputedStyle(document.documentElement).fontSize;
  const parsedRootFontSize = Number.parseFloat(rootFontSizeValue);
  const rootFontSize = rootFontSizeValue.endsWith("%")
    ? (parsedRootFontSize / 100) * 16
    : parsedRootFontSize;

  const proximity = 30 * (Number.isFinite(rootFontSize) ? rootFontSize : 16);
  const leftDistance = position.x - bounds.left;
  const rightDistance = bounds.right - position.x;
  const isNearLeft = leftDistance <= proximity;
  const isNearRight = rightDistance <= proximity;

  if (isNearLeft && isNearRight) return leftDistance <= rightDistance ? "left" : "right";
  if (isNearLeft) return "left";
  if (isNearRight) return "right";
  return null;
}

function SidebarDropSurface() {
  const { ref } = useDroppable({
    accept: "sidebar-view",
    id: "sidebar-drop-surface",
    type: "sidebar-region",
  });

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-50 bg-transparent"
      ref={ref}
    />
  );
}

function AppLayoutSeparator({
  isClosing,
  isCollapsed,
  isCompact,
}: {
  isClosing?: boolean;
  isCollapsed?: boolean;
  isCompact: boolean;
}) {
  return (
    <ResizableHandle
      className={cn(
        "workspace-separator self-start transition-[width] duration-200 motion-reduce:transition-none",
        isCompact && !isCollapsed ? undefined : "bg-transparent",
      )}
      disabled={isClosing}
      style={
        isClosing ? { width: 0 } : isCompact && !isCollapsed ? undefined : { width: "0.375rem" }
      }
      withHandle={!isClosing && (!isCompact || isCollapsed)}
    />
  );
}

export { AppLayout };

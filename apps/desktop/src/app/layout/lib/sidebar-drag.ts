import type { DragEndEvent, DragMoveEvent, DragStartEvent } from "@dnd-kit/react";

import {
  isSidebarId,
  isSidebarViewId,
  type SidebarId,
  type SidebarViewBounds,
  type SidebarViewId,
} from "@/app/layout/lib/sidebar-layout";

type SidebarDragEvent = DragStartEvent | DragMoveEvent | DragEndEvent;

interface SidebarDragPosition {
  x: number;
  y: number;
}

interface SidebarDragPreview {
  position: SidebarDragPosition;
  viewId: SidebarViewId;
}

interface SidebarDragGeometry {
  panelBounds: Map<SidebarViewId, SidebarViewBounds>;
  regionTops: Map<SidebarId, number>;
}

const SIDEBAR_PROXIMITY_SIZE_REM = 32;

function getDragPosition(event: SidebarDragEvent): SidebarDragPosition | undefined {
  return ("to" in event ? event.to : undefined) ?? event.operation.position.current;
}

function getSidebarDragPreview(event: DragStartEvent | DragMoveEvent): SidebarDragPreview | null {
  const viewId = event.operation.source?.id;
  const position = getDragPosition(event);
  if (!isSidebarViewId(viewId) || !position) return null;

  return { position: { x: position.x, y: position.y }, viewId };
}

function captureSidebarDragGeometry(): SidebarDragGeometry {
  const panelBounds = new Map<SidebarViewId, SidebarViewBounds>(
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

  const regionTops = new Map<SidebarId, number>(
    Array.from(document.querySelectorAll<HTMLElement>("[data-sidebar-region]")).flatMap(
      (region) => {
        const side = region.dataset.sidebarRegion;
        if (!isSidebarId(side)) return [];
        return [[side, region.getBoundingClientRect().top]] as const;
      },
    ),
  );

  return { panelBounds, regionTops };
}

function getSidebarProximitySide(position: SidebarDragPosition | undefined): SidebarId | null {
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

  const proximity =
    SIDEBAR_PROXIMITY_SIZE_REM * (Number.isFinite(rootFontSize) ? rootFontSize : 16);

  const leftDistance = position.x - bounds.left;
  const rightDistance = bounds.right - position.x;
  const isNearLeft = leftDistance <= proximity;
  const isNearRight = rightDistance <= proximity;

  if (isNearLeft && isNearRight) return leftDistance <= rightDistance ? "left" : "right";
  if (isNearLeft) return "left";
  if (isNearRight) return "right";
  return null;
}

function getSidebarDropRegion(
  position: SidebarDragPosition,
  autoExpandedDestination: SidebarId | null,
) {
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

  const region = usesEmptyTarget ? emptyTarget : populatedRegion;
  if (!region) return null;

  return { destination, region, usesEmptyTarget };
}

function getKeyboardPreviewPosition(
  destination: SidebarId,
  indicatorOffset: number | undefined,
  regionTop: number | undefined,
  initialPosition: SidebarDragPosition,
): SidebarDragPosition {
  const workspace = document.getElementById("workspace")?.getBoundingClientRect();
  if (!workspace || indicatorOffset === undefined) return initialPosition;

  return {
    x: destination === "left" ? workspace.left + 24 : workspace.right - 240,
    y: (regionTop ?? workspace.top) + indicatorOffset,
  };
}

export {
  captureSidebarDragGeometry,
  getDragPosition,
  getKeyboardPreviewPosition,
  getSidebarDragPreview,
  getSidebarDropRegion,
  getSidebarProximitySide,
};
export type { SidebarDragEvent, SidebarDragGeometry, SidebarDragPosition, SidebarDragPreview };

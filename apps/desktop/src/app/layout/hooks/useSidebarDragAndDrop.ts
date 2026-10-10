import type { DragEndEvent, DragMoveEvent, DragStartEvent } from "@dnd-kit/react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  captureSidebarDragGeometry,
  getDragPosition,
  getKeyboardPreviewPosition,
  getSidebarDragPreview,
  getSidebarDropRegion,
  getSidebarProximitySide,
  type SidebarDragGeometry,
  type SidebarDragPosition,
  type SidebarDragPreview,
} from "@/app/layout/lib/sidebar-drag";
import {
  isSidebarViewId,
  resolveSidebarDropPlacement,
  resolveSidebarDropPlacementAtIndex,
  type SidebarDropPlacement,
  type SidebarId,
  type SidebarViewBounds,
  type SidebarViewId,
} from "@/app/layout/lib/sidebar-layout";
import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import { selectSidebarLayout, sidebarLayoutChanged } from "@/app/store/slices/preferences-slice";

import { useSidebarVisibility } from "./useSidebarVisibility";

interface ActiveSidebarDragExpansion {
  collapsedAtStart: Set<SidebarId>;
  expandedByDrag: Set<SidebarId>;
  temporarilyExpanded: Set<SidebarId>;
}

interface KeyboardSidebarDrag {
  destination: SidebarId;
  initialPosition: SidebarDragPosition;
  insertionIndex: number;
  placement: SidebarDropPlacement | null;
  viewId: SidebarViewId;
}

type ActiveSidebarDragMode = "keyboard" | "pointer" | null;

function useSidebarDragAndDrop() {
  const dispatch = useAppDispatch();
  const { t } = useTranslation();
  const sidebarLayout = useAppSelector(selectSidebarLayout);
  const sidebarVisibility = useSidebarVisibility();
  const [isDraggingView, setIsDraggingView] = useState(false);
  const [dropPlacement, setDropPlacement] = useState<SidebarDropPlacement | null>(null);
  const [dragPreview, setDragPreview] = useState<SidebarDragPreview | null>(null);
  const [keyboardDragAnnouncement, setKeyboardDragAnnouncement] = useState("");

  const dragGeometry = useRef<SidebarDragGeometry>({
    panelBounds: new Map(),
    regionTops: new Map(),
  });

  const dragSidebarExpansion = useRef<ActiveSidebarDragExpansion | null>(null);
  const activeDragMode = useRef<ActiveSidebarDragMode>(null);
  const keyboardSidebarDrag = useRef<KeyboardSidebarDrag | null>(null);

  const initializeSidebarDrag = useCallback(
    (viewId: SidebarViewId, position: SidebarDragPosition) => {
      dragSidebarExpansion.current = {
        collapsedAtStart: new Set([
          ...(sidebarVisibility.hasLeftSidebar && sidebarVisibility.isSidebarCollapsed("left")
            ? ["left" as const]
            : []),
          ...(sidebarVisibility.hasRightSidebar && sidebarVisibility.isSidebarCollapsed("right")
            ? ["right" as const]
            : []),
        ]),
        expandedByDrag: new Set(),
        temporarilyExpanded: new Set(),
      };
      dragGeometry.current = captureSidebarDragGeometry();
      setDragPreview({ position, viewId });
      setIsDraggingView(true);
    },
    [sidebarVisibility],
  );

  const updateDragSidebarDestination = useCallback(
    (destination: SidebarId | null) => {
      const expansion = dragSidebarExpansion.current;
      if (!expansion) return;

      for (const side of expansion.temporarilyExpanded) {
        if (side === destination) continue;

        sidebarVisibility.setSidebarExpanded(side, false);
        expansion.temporarilyExpanded.delete(side);
      }

      const sideHasPanels = destination ? sidebarLayout[destination].length > 0 : false;
      if (
        destination &&
        sideHasPanels &&
        expansion.collapsedAtStart.has(destination) &&
        !expansion.temporarilyExpanded.has(destination)
      ) {
        sidebarVisibility.setSidebarExpanded(destination, true);
        expansion.temporarilyExpanded.add(destination);
        expansion.expandedByDrag.add(destination);
      }
    },
    [sidebarLayout, sidebarVisibility],
  );

  const updateDragSidebarExpansion = useCallback(
    (position: SidebarDragPosition | undefined) => {
      updateDragSidebarDestination(getSidebarProximitySide(position));
    },
    [updateDragSidebarDestination],
  );

  const getDropPlacement = useCallback(
    (event: DragMoveEvent | DragEndEvent) => {
      const viewId = event.operation.source?.id;
      if (!isSidebarViewId(viewId)) return null;

      const position = getDragPosition(event);
      if (!position) return null;

      const expansion = dragSidebarExpansion.current;
      const proximitySide = getSidebarProximitySide(position);
      const autoExpandedDestination =
        proximitySide && expansion?.temporarilyExpanded.has(proximitySide) ? proximitySide : null;

      const dropRegion = getSidebarDropRegion(position, autoExpandedDestination);
      if (!dropRegion) return null;

      const { destination, region, usesEmptyTarget } = dropRegion;
      const destinationBounds: SidebarViewBounds[] = sidebarLayout[destination]
        .filter((item) => item !== viewId)
        .flatMap((item) => {
          const bounds = dragGeometry.current.panelBounds.get(item);
          return bounds ? [bounds] : [];
        });

      const regionTop = usesEmptyTarget
        ? region.getBoundingClientRect().top
        : (dragGeometry.current.regionTops.get(destination) ?? region.getBoundingClientRect().top);

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

  const getKeyboardDropPlacement = useCallback(
    (viewId: SidebarViewId, destination: SidebarId, insertionIndex: number) => {
      const destinationBounds = sidebarLayout[destination]
        .filter((item) => item !== viewId)
        .flatMap((item) => {
          const bounds = dragGeometry.current.panelBounds.get(item);
          return bounds ? [bounds] : [];
        });

      const workspaceTop = document.getElementById("workspace")?.getBoundingClientRect().top ?? 0;
      const regionTop = dragGeometry.current.regionTops.get(destination) ?? workspaceTop;

      return resolveSidebarDropPlacementAtIndex(
        sidebarLayout,
        viewId,
        destination,
        insertionIndex,
        destinationBounds,
        regionTop,
      );
    },
    [sidebarLayout],
  );

  const clearDragState = useCallback(() => {
    dragSidebarExpansion.current = null;
    keyboardSidebarDrag.current = null;
    activeDragMode.current = null;
    dragGeometry.current = { panelBounds: new Map(), regionTops: new Map() };
    setDropPlacement(null);
    setDragPreview(null);
    setIsDraggingView(false);
  }, []);

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const viewId = event.operation.source?.id;
      const position = getDragPosition(event);
      if (!isSidebarViewId(viewId) || !position || activeDragMode.current !== null) return;

      activeDragMode.current = "pointer";
      initializeSidebarDrag(viewId, position);
    },
    [initializeSidebarDrag],
  );

  const handleDragMove = useCallback(
    (event: DragMoveEvent) => {
      if (activeDragMode.current !== "pointer") return;

      updateDragSidebarExpansion(getDragPosition(event));
      setDropPlacement(getDropPlacement(event));
      setDragPreview(getSidebarDragPreview(event));
    },
    [getDropPlacement, updateDragSidebarExpansion],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      if (activeDragMode.current !== "pointer") return;

      if (!event.canceled) updateDragSidebarExpansion(getDragPosition(event));
      const placement = event.canceled ? null : getDropPlacement(event);
      for (const side of dragSidebarExpansion.current?.expandedByDrag ?? []) {
        sidebarVisibility.setSidebarExpanded(side, placement?.destination === side);
      }

      clearDragState();
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
    [clearDragState, dispatch, getDropPlacement, sidebarVisibility, updateDragSidebarExpansion],
  );

  const finishKeyboardDrag = useCallback(
    (canceled: boolean) => {
      const currentDrag = keyboardSidebarDrag.current;
      if (!currentDrag) return;

      const placement = canceled ? null : currentDrag.placement;
      for (const side of dragSidebarExpansion.current?.expandedByDrag ?? []) {
        sidebarVisibility.setSidebarExpanded(side, placement?.destination === side);
      }

      clearDragState();
      if (placement) {
        const destinationTitle =
          placement.destination === "left" ? t("layout.leftSidebar") : t("layout.rightSidebar");

        dispatch(
          sidebarLayoutChanged({
            destination: placement.destination,
            insertionIndex: placement.insertionIndex,
            viewId: placement.viewId,
          }),
        );
        setKeyboardDragAnnouncement(
          t("layout.keyboardDragDropped", {
            sidebar: destinationTitle,
            view:
              currentDrag.viewId === "sources"
                ? t("source.importedSources")
                : t("layout.activityFeed"),
          }),
        );
      } else {
        const viewTitle =
          currentDrag.viewId === "sources" ? t("source.importedSources") : t("layout.activityFeed");

        setKeyboardDragAnnouncement(
          canceled
            ? t("layout.keyboardDragCanceled", { view: viewTitle })
            : t("layout.keyboardDragUnchanged", { view: viewTitle }),
        );
      }
    },
    [clearDragState, dispatch, sidebarVisibility, t],
  );

  const handleKeyboardDragKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLElement>) => {
      const keyboardDrag = keyboardSidebarDrag.current;
      if (!keyboardDrag) {
        const target = event.target instanceof Element ? event.target : null;
        const handle = target?.closest<HTMLElement>("[data-sidebar-view-handle]");
        const viewId = handle?.dataset.sidebarViewHandle;
        if (
          event.key.toLowerCase() !== "d" ||
          event.repeat ||
          event.altKey ||
          event.ctrlKey ||
          event.metaKey ||
          activeDragMode.current !== null ||
          !handle ||
          !isSidebarViewId(viewId) ||
          (!sidebarLayout.left.includes(viewId) && !sidebarLayout.right.includes(viewId))
        ) {
          return;
        }

        event.preventDefault();
        const destination: SidebarId = sidebarLayout.left.includes(viewId) ? "left" : "right";
        const bounds = handle.getBoundingClientRect();
        const initialPosition = { x: bounds.left, y: bounds.top };
        const insertionIndex = sidebarLayout[destination].indexOf(viewId);

        activeDragMode.current = "keyboard";
        initializeSidebarDrag(viewId, initialPosition);
        updateDragSidebarDestination(destination);

        const placement = getKeyboardDropPlacement(viewId, destination, insertionIndex);
        keyboardSidebarDrag.current = {
          destination,
          initialPosition,
          insertionIndex,
          placement,
          viewId,
        };
        setDropPlacement(placement);
        setKeyboardDragAnnouncement(
          t("layout.keyboardDragStarted", {
            view: viewId === "sources" ? t("source.importedSources") : t("layout.activityFeed"),
          }),
        );
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        finishKeyboardDrag(true);
        return;
      }

      if (event.key === "Tab") {
        finishKeyboardDrag(true);
        return;
      }

      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        return;
      }

      if (event.key.toLowerCase() === "d") {
        event.preventDefault();
        finishKeyboardDrag(false);
        return;
      }

      if (
        event.key !== "ArrowUp" &&
        event.key !== "ArrowDown" &&
        event.key !== "ArrowLeft" &&
        event.key !== "ArrowRight"
      ) {
        return;
      }

      event.preventDefault();
      let destination = keyboardDrag.destination;
      let insertionIndex = keyboardDrag.insertionIndex;
      if (event.key === "ArrowUp") {
        insertionIndex = Math.max(0, insertionIndex - 1);
      } else if (event.key === "ArrowDown") {
        const maximumIndex = sidebarLayout[destination].filter(
          (viewId) => viewId !== keyboardDrag.viewId,
        ).length;

        insertionIndex = Math.min(maximumIndex, insertionIndex + 1);
      } else {
        destination = event.key === "ArrowLeft" ? "left" : "right";
        const maximumIndex = sidebarLayout[destination].filter(
          (viewId) => viewId !== keyboardDrag.viewId,
        ).length;

        insertionIndex = Math.min(maximumIndex, insertionIndex);
      }

      if (
        destination === keyboardDrag.destination &&
        insertionIndex === keyboardDrag.insertionIndex
      ) {
        return;
      }

      updateDragSidebarDestination(destination);
      const placement = getKeyboardDropPlacement(keyboardDrag.viewId, destination, insertionIndex);
      keyboardSidebarDrag.current = { ...keyboardDrag, destination, insertionIndex, placement };
      setDropPlacement(placement);
      setDragPreview({
        position: getKeyboardPreviewPosition(
          destination,
          placement?.indicatorOffset,
          dragGeometry.current.regionTops.get(destination),
          keyboardDrag.initialPosition,
        ),
        viewId: keyboardDrag.viewId,
      });

      const availableSlots =
        sidebarLayout[destination].filter((viewId) => viewId !== keyboardDrag.viewId).length + 1;

      const destinationTitle =
        destination === "left" ? t("layout.leftSidebar") : t("layout.rightSidebar");

      setKeyboardDragAnnouncement(
        t("layout.keyboardDragPosition", {
          position: insertionIndex + 1,
          count: availableSlots,
          sidebar: destinationTitle,
          view:
            keyboardDrag.viewId === "sources"
              ? t("source.importedSources")
              : t("layout.activityFeed"),
        }),
      );
    },
    [
      finishKeyboardDrag,
      getKeyboardDropPlacement,
      initializeSidebarDrag,
      sidebarLayout,
      t,
      updateDragSidebarDestination,
    ],
  );

  return {
    dragPreview,
    dropPlacement,
    handleDragEnd,
    handleDragMove,
    handleDragStart,
    handleKeyboardDragKeyDown,
    isDraggingView,
    keyboardDragAnnouncement,
    sidebarLayout,
    sidebarVisibility,
  };
}

export { useSidebarDragAndDrop };

import {
  DragDropProvider,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
  useDroppable,
} from "@dnd-kit/react";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";

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
  resolveSidebarDropPlacementAtIndex,
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

import { useSidebarPresence } from "./hooks/useSidebarPresence";
import { useSidebarVisibility } from "./hooks/useSidebarVisibility";

interface ActiveSidebarDragExpansion {
  collapsedAtStart: Set<SidebarId>;
  expandedByDrag: Set<SidebarId>;
  temporarilyExpanded: Set<SidebarId>;
}

interface KeyboardSidebarDrag {
  destination: SidebarId;
  initialPosition: { x: number; y: number };
  insertionIndex: number;
  placement: SidebarDropPlacement | null;
  viewId: SidebarViewId;
}

type ActiveSidebarDragMode = "keyboard" | "pointer" | null;

const WORKSPACE_SIDEBAR_WIDTHS_STORAGE_KEY = "react-resizable-panels:workspace-sidebar-widths";

function AppLayout() {
  const dispatch = useAppDispatch();
  const { t } = useTranslation();
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

  const [keyboardDragAnnouncement, setKeyboardDragAnnouncement] = useState("");

  const [workspaceSidebarWidths, setWorkspaceSidebarWidths] = useState<
    Partial<Record<SidebarId, string>>
  >(getSavedWorkspaceSidebarWidths);

  const leftSidebarPresence = useSidebarPresence("left", hasLeftSidebar);
  const rightSidebarPresence = useSidebarPresence("right", hasRightSidebar);

  const dragStartPanelBounds = useRef<Map<SidebarViewId, SidebarViewBounds>>(new Map());
  const dragStartRegionTops = useRef<Map<SidebarId, number>>(new Map());
  const dragSidebarExpansion = useRef<ActiveSidebarDragExpansion | null>(null);
  const activeDragMode = useRef<ActiveSidebarDragMode>(null);
  const keyboardSidebarDrag = useRef<KeyboardSidebarDrag | null>(null);
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

  const initializeSidebarDrag = useCallback(
    (viewId: SidebarViewId, position: { x: number; y: number }) => {
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
            const panelViewId = viewElement.dataset.sidebarView;
            const panel = viewElement.closest<HTMLElement>('[data-slot="resizable-panel"]');
            if (!isSidebarViewId(panelViewId) || !panel) return [];

            const bounds = panel.getBoundingClientRect();
            return [
              [panelViewId, { bottom: bounds.bottom, top: bounds.top, viewId: panelViewId }],
            ] as const;
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
      setDragPreview({ position, viewId });
      setIsDraggingView(true);
    },
    [hasLeftSidebar, hasRightSidebar, isSidebarCollapsed],
  );

  const updateDragSidebarDestination = useCallback(
    (destination: SidebarId | null) => {
      const expansion = dragSidebarExpansion.current;
      if (!expansion) return;

      for (const side of expansion.temporarilyExpanded) {
        if (side === destination) continue;

        setSidebarExpanded(side, false);
        expansion.temporarilyExpanded.delete(side);
      }

      const sideHasPanels = destination ? sidebarLayout[destination].length > 0 : false;
      if (
        destination &&
        sideHasPanels &&
        expansion.collapsedAtStart.has(destination) &&
        !expansion.temporarilyExpanded.has(destination)
      ) {
        setSidebarExpanded(destination, true);
        expansion.temporarilyExpanded.add(destination);
        expansion.expandedByDrag.add(destination);
      }
    },
    [setSidebarExpanded, sidebarLayout],
  );

  const updateDragSidebarExpansion = useCallback(
    (position: { x: number; y: number } | undefined) => {
      const proximitySide = getSidebarProximitySide(position);
      updateDragSidebarDestination(proximitySide);
    },
    [updateDragSidebarDestination],
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

  const getKeyboardDropPlacement = useCallback(
    (viewId: SidebarViewId, destination: SidebarId, insertionIndex: number) => {
      const destinationBounds = sidebarLayout[destination]
        .filter((item) => item !== viewId)
        .flatMap((item) => {
          const bounds = dragStartPanelBounds.current.get(item);
          return bounds ? [bounds] : [];
        });

      const workspaceTop = document.getElementById("workspace")?.getBoundingClientRect().top ?? 0;
      const regionTop = dragStartRegionTops.current.get(destination) ?? workspaceTop;

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

  const getKeyboardPreviewPosition = useCallback(
    (
      destination: SidebarId,
      placement: SidebarDropPlacement | null,
      initialPosition: { x: number; y: number },
    ) => {
      if (!placement) return initialPosition;

      const workspace = document.getElementById("workspace")?.getBoundingClientRect();
      if (!workspace) return initialPosition;

      const regionTop = dragStartRegionTops.current.get(destination) ?? workspace.top;
      return {
        x: destination === "left" ? workspace.left + 24 : workspace.right - 240,
        y: regionTop + placement.indicatorOffset,
      };
    },
    [],
  );

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
        setSidebarExpanded(side, placement?.destination === side);
      }
      dragSidebarExpansion.current = null;
      activeDragMode.current = null;
      keyboardSidebarDrag.current = null;
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

  const handleSidebarKeyboardDragKeyDown = useCallback(
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
          !isSidebarViewId(viewId) ||
          (!sidebarLayout.left.includes(viewId) && !sidebarLayout.right.includes(viewId))
        ) {
          return;
        }

        event.preventDefault();
        const destination: SidebarId = sidebarLayout.left.includes(viewId) ? "left" : "right";
        const bounds = handle!.getBoundingClientRect();
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

      const finishKeyboardDrag = (canceled: boolean) => {
        const currentDrag = keyboardSidebarDrag.current;
        if (!currentDrag) return;

        const placement = canceled ? null : currentDrag.placement;
        for (const side of dragSidebarExpansion.current?.expandedByDrag ?? []) {
          setSidebarExpanded(side, placement?.destination === side);
        }

        keyboardSidebarDrag.current = null;
        dragSidebarExpansion.current = null;
        activeDragMode.current = null;
        setDropPlacement(null);
        setDragPreview(null);
        setIsDraggingView(false);
        dragStartPanelBounds.current.clear();
        dragStartRegionTops.current.clear();

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
            currentDrag.viewId === "sources"
              ? t("source.importedSources")
              : t("layout.activityFeed");

          setKeyboardDragAnnouncement(
            canceled
              ? t("layout.keyboardDragCanceled", { view: viewTitle })
              : t("layout.keyboardDragUnchanged", { view: viewTitle }),
          );
        }
      };

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
      const updatedDrag = { ...keyboardDrag, destination, insertionIndex, placement };
      keyboardSidebarDrag.current = updatedDrag;
      setDropPlacement(placement);
      setDragPreview({
        position: getKeyboardPreviewPosition(destination, placement, keyboardDrag.initialPosition),
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
      dispatch,
      getKeyboardDropPlacement,
      getKeyboardPreviewPosition,
      initializeSidebarDrag,
      setSidebarExpanded,
      sidebarLayout,
      t,
      updateDragSidebarDestination,
    ],
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
      <main
        className="fixed inset-0 grid h-dvh w-screen grid-rows-[2.25rem_minmax(0,1fr)_auto] overflow-hidden bg-background"
        onKeyDown={handleSidebarKeyboardDragKeyDown}
      >
        <div aria-atomic="true" aria-live="polite" className="sr-only" role="status">
          {keyboardDragAnnouncement}
        </div>
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

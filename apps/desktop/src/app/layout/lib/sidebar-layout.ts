const SIDEBAR_IDS = ["left", "right"] as const;
const SIDEBAR_VIEW_IDS = ["sources", "activity"] as const;

type SidebarId = (typeof SIDEBAR_IDS)[number];
type SidebarViewId = (typeof SIDEBAR_VIEW_IDS)[number];

interface SidebarLayout {
  left: SidebarViewId[];
  right: SidebarViewId[];
}

interface SidebarDropPlacement {
  destination: SidebarId;
  insertionIndex: number;
  previewTop: number;
  viewId: SidebarViewId;
}

interface SidebarViewBounds {
  bottom: number;
  top: number;
  viewId: SidebarViewId;
}

const DEFAULT_SIDEBAR_LAYOUT: SidebarLayout = {
  left: ["sources", "activity"],
  right: [],
};

function isSidebarId(value: unknown): value is SidebarId {
  return typeof value === "string" && SIDEBAR_IDS.includes(value as SidebarId);
}

function isSidebarViewId(value: unknown): value is SidebarViewId {
  return typeof value === "string" && SIDEBAR_VIEW_IDS.includes(value as SidebarViewId);
}

function normalizeSidebarLayout(value: unknown): SidebarLayout {
  if (
    typeof value !== "object" ||
    value === null ||
    !("left" in value) ||
    !("right" in value) ||
    !Array.isArray(value.left) ||
    !Array.isArray(value.right)
  ) {
    return { left: [...DEFAULT_SIDEBAR_LAYOUT.left], right: [] };
  }

  const seen = new Set<SidebarViewId>();
  const collect = (items: unknown[]): SidebarViewId[] =>
    items.filter((item): item is SidebarViewId => {
      if (!isSidebarViewId(item) || seen.has(item)) return false;
      seen.add(item);
      return true;
    });

  const left = collect(value.left);
  const right = collect(value.right);

  // New views join the default region so persisted layouts remain usable after updates.
  for (const viewId of DEFAULT_SIDEBAR_LAYOUT.left) {
    if (!seen.has(viewId)) left.push(viewId);
  }

  return { left, right };
}

function moveSidebarView(
  layout: SidebarLayout,
  viewId: SidebarViewId,
  destination: SidebarId,
  insertionIndex: number,
): SidebarLayout {
  const normalized = normalizeSidebarLayout(layout);
  const next: SidebarLayout = {
    left: normalized.left.filter((item) => item !== viewId),
    right: normalized.right.filter((item) => item !== viewId),
  };

  const destinationViews = next[destination];
  const index = Number.isFinite(insertionIndex)
    ? Math.max(0, Math.min(destinationViews.length, Math.trunc(insertionIndex)))
    : destinationViews.length;

  destinationViews.splice(index, 0, viewId);

  const unchanged = (side: SidebarId) =>
    layout[side].length === next[side].length &&
    layout[side].every((item, position) => item === next[side][position]);

  if (unchanged("left") && unchanged("right")) return layout;

  return next;
}

function resolveSidebarDropPlacement(
  layout: SidebarLayout,
  viewId: SidebarViewId,
  destination: SidebarId,
  pointerY: number,
  regionTop: number,
  destinationBounds: SidebarViewBounds[],
): SidebarDropPlacement | null {
  const destinationViews = layout[destination].filter((item) => item !== viewId);
  const boundsByView = new Map(destinationBounds.map((bounds) => [bounds.viewId, bounds]));
  const resolvedIndex = resolveSidebarInsertionIndex(
    pointerY,
    destinationViews.flatMap((item) => {
      const bounds = boundsByView.get(item);
      return bounds ? [bounds] : [];
    }),
  );

  if (
    layout[destination].includes(viewId) &&
    layout[destination].indexOf(viewId) === resolvedIndex
  ) {
    return null;
  }

  const nextView = destinationViews[resolvedIndex];
  const previousView = destinationViews[resolvedIndex - 1];
  const previewTop = nextView
    ? (boundsByView.get(nextView)?.top ?? regionTop) - regionTop
    : previousView
      ? (boundsByView.get(previousView)?.bottom ?? regionTop) - regionTop
      : 0;

  return { destination, insertionIndex: resolvedIndex, previewTop, viewId };
}

function resolveSidebarInsertionIndex(
  pointerY: number,
  destinationBounds: Array<Pick<SidebarViewBounds, "bottom" | "top">>,
): number {
  const index = destinationBounds.findIndex(
    (bounds) => pointerY < bounds.top + (bounds.bottom - bounds.top) / 2,
  );

  return index < 0 ? destinationBounds.length : index;
}

export {
  DEFAULT_SIDEBAR_LAYOUT,
  isSidebarId,
  isSidebarViewId,
  moveSidebarView,
  normalizeSidebarLayout,
  resolveSidebarDropPlacement,
  resolveSidebarInsertionIndex,
  SIDEBAR_IDS,
  SIDEBAR_VIEW_IDS,
};
export type { SidebarDropPlacement, SidebarId, SidebarLayout, SidebarViewBounds, SidebarViewId };

const SIDEBAR_IDS = ["left", "right"] as const;
const SIDEBAR_VIEW_IDS = ["sources", "activity"] as const;

type SidebarId = (typeof SIDEBAR_IDS)[number];
type SidebarViewId = (typeof SIDEBAR_VIEW_IDS)[number];

interface SidebarLayout {
  left: SidebarViewId[];
  right: SidebarViewId[];
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
  return next;
}

export {
  DEFAULT_SIDEBAR_LAYOUT,
  SIDEBAR_IDS,
  SIDEBAR_VIEW_IDS,
  isSidebarId,
  isSidebarViewId,
  moveSidebarView,
  normalizeSidebarLayout,
};
export type { SidebarId, SidebarLayout, SidebarViewId };

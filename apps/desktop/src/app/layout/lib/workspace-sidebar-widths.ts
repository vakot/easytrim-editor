import { SIDEBAR_IDS, type SidebarId } from "@/app/layout/lib/sidebar-layout";

const WORKSPACE_SIDEBAR_WIDTHS_STORAGE_KEY = "react-resizable-panels:workspace-sidebar-widths";

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
    for (const side of SIDEBAR_IDS) {
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

function saveWorkspaceSidebarWidth(side: SidebarId, width: number): void {
  const savedWidths = readSavedWorkspaceSidebarWidths();
  savedWidths[side] = width;
  try {
    localStorage.setItem(WORKSPACE_SIDEBAR_WIDTHS_STORAGE_KEY, JSON.stringify(savedWidths));
  } catch {
    // Resizing remains available when browser storage cannot be written.
  }
}

export {
  getSavedWorkspaceSidebarWidths,
  readSavedWorkspaceSidebarWidths,
  saveWorkspaceSidebarWidth,
};

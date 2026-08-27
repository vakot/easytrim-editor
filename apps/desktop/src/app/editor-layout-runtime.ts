import { EDITOR_PANEL_IDS, type EditorPanelId } from "@/app/store/slices/editor-layout-slice";

export const EDITOR_PANEL_GROUP_IDS = {
  workspace: "editor-workspace-panels",
  stage: "editor-stage-panels",
  sourceSidebar: "source-sidebar-sections",
} as const;

const STORAGE_KEY_PREFIX = "react-resizable-panels:";
const PANEL_GROUP_IDS: Record<EditorPanelId, string> = {
  [EDITOR_PANEL_IDS.sourceDetails]: EDITOR_PANEL_GROUP_IDS.workspace,
  [EDITOR_PANEL_IDS.timeline]: EDITOR_PANEL_GROUP_IDS.stage,
  [EDITOR_PANEL_IDS.sidebarMedia]: EDITOR_PANEL_GROUP_IDS.sourceSidebar,
  [EDITOR_PANEL_IDS.sidebarImportedQueue]: EDITOR_PANEL_GROUP_IDS.sourceSidebar,
  [EDITOR_PANEL_IDS.sidebarExportQueue]: EDITOR_PANEL_GROUP_IDS.sourceSidebar,
};

interface EditorPanelSizeResetRegistration {
  panelIds: readonly EditorPanelId[];
  reset: () => void;
}

const sizeResetRegistrations = new Set<EditorPanelSizeResetRegistration>();

export function registerEditorPanelSizeReset(
  registration: EditorPanelSizeResetRegistration,
): () => void {
  sizeResetRegistrations.add(registration);
  return () => sizeResetRegistrations.delete(registration);
}

export function resetEditorPanelSizes(panelIds: readonly EditorPanelId[]): void {
  const requestedPanelIds = new Set(panelIds);
  const groupIds = new Set(panelIds.map((panelId) => PANEL_GROUP_IDS[panelId]));

  clearSavedEditorLayouts(groupIds);

  const resetRegisteredPanels = () => {
    sizeResetRegistrations.forEach((registration) => {
      if (registration.panelIds.some((panelId) => requestedPanelIds.has(panelId))) {
        registration.reset();
      }
    });
  };

  if (typeof requestAnimationFrame === "undefined") {
    resetRegisteredPanels();
  } else {
    requestAnimationFrame(resetRegisteredPanels);
  }
}

function clearSavedEditorLayouts(groupIds: ReadonlySet<string>): void {
  if (typeof localStorage === "undefined") return;

  const groupKeyPrefixes = [...groupIds].map((groupId) => `${STORAGE_KEY_PREFIX}${groupId}`);

  for (let index = localStorage.length - 1; index >= 0; index -= 1) {
    const key = localStorage.key(index);
    if (key && groupKeyPrefixes.some((prefix) => key === prefix || key.startsWith(`${prefix}:`))) {
      localStorage.removeItem(key);
    }
  }
}

export const EDITOR_PANEL_GROUP_IDS = {
  workspace: "editor-workspace-panels",
  stage: "editor-stage-panels",
  sourceSidebar: "source-sidebar-sections",
} as const;

const STORAGE_KEY_PREFIX = "react-resizable-panels:";
const resetHandlers = new Set<() => void>();

export function registerEditorLayoutReset(handler: () => void): () => void {
  resetHandlers.add(handler);
  return () => resetHandlers.delete(handler);
}

export function resetEditorLayoutRuntime(): void {
  clearSavedEditorLayouts();
  resetHandlers.forEach((handler) => handler());
}

function clearSavedEditorLayouts(): void {
  if (typeof localStorage === "undefined") return;

  const groupKeyPrefixes = Object.values(EDITOR_PANEL_GROUP_IDS).map(
    (groupId) => `${STORAGE_KEY_PREFIX}${groupId}`,
  );

  for (let index = localStorage.length - 1; index >= 0; index -= 1) {
    const key = localStorage.key(index);
    if (key && groupKeyPrefixes.some((prefix) => key === prefix || key.startsWith(`${prefix}:`))) {
      localStorage.removeItem(key);
    }
  }
}

import type { PanelId } from "@/app/store/slices/panel-layout-slice";

export const PANEL_GROUP_IDS = {
  workspace: "editor-workspace-panels",
  stage: "editor-stage-panels",
  sourceSidebar: "source-sidebar-sections",
} as const;

const STORAGE_KEY_PREFIX = "react-resizable-panels:";

interface PanelSizeResetRegistration {
  groupId?: string;
  panelIds: readonly PanelId[];
  reset?: () => void;
}

const sizeResetRegistrations = new Set<PanelSizeResetRegistration>();

export function registerPanelSizeReset(registration: PanelSizeResetRegistration): () => void {
  sizeResetRegistrations.add(registration);
  return () => sizeResetRegistrations.delete(registration);
}

export function resetPanelSizes(panelIds: readonly PanelId[]): void {
  const requestedPanelIds = new Set(panelIds);
  const matchesRequest = (registration: PanelSizeResetRegistration) =>
    registration.panelIds.some((panelId) => requestedPanelIds.has(panelId));
  const groupIds = new Set(
    [...sizeResetRegistrations]
      .filter(matchesRequest)
      .map((registration) => registration.groupId)
      .filter((groupId): groupId is string => groupId !== undefined),
  );

  clearSavedPanelLayouts(groupIds);

  const resetRegisteredPanels = () => {
    sizeResetRegistrations.forEach((registration) => {
      if (matchesRequest(registration)) registration.reset?.();
    });
  };

  if (typeof requestAnimationFrame === "undefined") {
    resetRegisteredPanels();
  } else {
    requestAnimationFrame(resetRegisteredPanels);
  }
}

function clearSavedPanelLayouts(groupIds: ReadonlySet<string>): void {
  if (typeof localStorage === "undefined") return;

  const groupKeyPrefixes = [...groupIds].map((groupId) => `${STORAGE_KEY_PREFIX}${groupId}`);

  for (let index = localStorage.length - 1; index >= 0; index -= 1) {
    const key = localStorage.key(index);
    if (key && groupKeyPrefixes.some((prefix) => key === prefix || key.startsWith(`${prefix}:`))) {
      localStorage.removeItem(key);
    }
  }
}

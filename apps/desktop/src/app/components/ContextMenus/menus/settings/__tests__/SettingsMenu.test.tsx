import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Provider } from "react-redux";

import { SettingsMenu } from "../SettingsMenu";
import { createAppStore } from "@/app/store";
import { DEFAULT_TOOL_DEFAULTS } from "@/app/tool-settings";
import { STORAGE_KEYS } from "@/lib/storage";
import { TooltipProvider } from "@/components/ui/tooltip";

const sessionMock = vi.hoisted(() => ({
  source: null as { selection: { sourceId: string } } | null,
  handleSetAudioMerge: vi.fn(),
}));

vi.mock("@/app/hooks/useEditorSession", () => ({
  useEditorSession: () => ({
    session: { source: sessionMock.source },
    handleSetAudioMerge: sessionMock.handleSetAudioMerge,
  }),
}));

const navigation = {
  open: true,
  onOpenChange: vi.fn(),
  onTriggerPointerEnter: vi.fn(),
};

afterEach(() => {
  localStorage.clear();
  sessionMock.source = null;
  sessionMock.handleSetAudioMerge.mockReset();
});

function renderSettings() {
  const store = createAppStore();
  render(
    <Provider store={store}>
      <TooltipProvider>
        <SettingsMenu navigation={navigation} />
      </TooltipProvider>
    </Provider>,
  );
  return store;
}

describe("SettingsMenu Redux integration", () => {
  it("dispatches tool-default changes through Redux and persists the change", async () => {
    const user = userEvent.setup();
    const store = renderSettings();

    const loopRow = screen.getByRole("menuitem", { name: "Loop" });
    await user.click(within(loopRow).getByRole("switch"));

    expect(store.getState().preferences.toolDefaults.loopPlaybackEnabled).toBe(false);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.preferences) ?? "{}")).toEqual({
      toolDefaults: { ...DEFAULT_TOOL_DEFAULTS, loopPlaybackEnabled: false },
    });
  });

  it("dispatches reset while keeping the active-session value outside Redux", async () => {
    const user = userEvent.setup();
    const store = renderSettings();

    const mergeSwitch = within(screen.getByRole("menuitem", { name: "Merge audio" })).getByRole(
      "switch",
    );
    await user.click(mergeSwitch);
    await user.click(screen.getByRole("menuitem", { name: "Reset to default" }));

    expect(store.getState().preferences.toolDefaults).toEqual(DEFAULT_TOOL_DEFAULTS);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.preferences) ?? "{}")).toEqual({
      toolDefaults: DEFAULT_TOOL_DEFAULTS,
    });
  });

  it("keeps the merge-audio compatibility bridge explicit at the Settings boundary", async () => {
    const user = userEvent.setup();
    sessionMock.source = { selection: { sourceId: "source-1" } };
    renderSettings();

    const mergeSwitch = within(screen.getByRole("menuitem", { name: "Merge audio" })).getByRole(
      "switch",
    );
    await user.click(mergeSwitch);

    expect(sessionMock.handleSetAudioMerge).toHaveBeenCalledWith("source-1", true);
  });
});

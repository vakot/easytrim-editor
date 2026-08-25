import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Provider } from "react-redux";

import { SettingsMenu } from "../SettingsMenu";
import { createAppStore } from "@/app/store/store";
import { DEFAULT_TOOL_DEFAULTS } from "@/app/tool-settings";
import { sourceSelected } from "@/app/store/actions/source-actions";
import { selectMergeAudio } from "@/app/store/slices/audio-slice";
import { TooltipProvider } from "@/components/ui/tooltip";

const navigation = {
  open: true,
  onOpenChange: vi.fn(),
  onTriggerPointerEnter: vi.fn(),
  onTriggerPointerLeave: vi.fn(),
};

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
  it("dispatches tool-default changes through Redux", async () => {
    const user = userEvent.setup();
    const store = renderSettings();

    const loopRow = screen.getByRole("menuitem", { name: "Loop" });
    await user.click(within(loopRow).getByRole("switch"));

    expect(store.getState().preferences.toolDefaults.loopPlaybackEnabled).toBe(false);
  });

  it("shows queue auto start enabled by default and updates its preference", async () => {
    const user = userEvent.setup();
    const store = renderSettings();
    const autoStartQueueSwitch = within(
      screen.getByRole("menuitem", { name: "Auto-start Queue" }),
    ).getByRole("switch");

    expect(autoStartQueueSwitch).toBeChecked();

    await user.click(autoStartQueueSwitch);

    expect(store.getState().preferences.toolDefaults.autoStartQueue).toBe(false);
  });

  it("resets Preferences without rewriting active editor tools", async () => {
    const user = userEvent.setup();
    const store = renderSettings();

    const loopSwitch = within(screen.getByRole("menuitem", { name: "Loop" })).getByRole("switch");
    await user.click(loopSwitch);
    expect(store.getState().preferences.toolDefaults.loopPlaybackEnabled).toBe(false);
    expect(store.getState().editorTools.loopPlaybackEnabled).toBe(true);
    const mergeSwitch = within(screen.getByRole("menuitem", { name: "Merge audio" })).getByRole(
      "switch",
    );
    await user.click(mergeSwitch);
    await user.click(screen.getByRole("menuitem", { name: "Reset to default" }));

    expect(store.getState().preferences.toolDefaults).toEqual(DEFAULT_TOOL_DEFAULTS);
    expect(store.getState().editorTools.loopPlaybackEnabled).toBe(true);
  });

  it("keeps the merge-audio compatibility bridge explicit at the Settings boundary", async () => {
    const user = userEvent.setup();
    const store = renderSettings();
    store.dispatch(sourceSelected({ source: { sourceId: "source-1", displayName: "source.mp4" } }));

    const mergeSwitch = within(screen.getByRole("menuitem", { name: "Merge audio" })).getByRole(
      "switch",
    );
    await user.click(mergeSwitch);

    expect(selectMergeAudio(store.getState())).toBe(true);
  });
});

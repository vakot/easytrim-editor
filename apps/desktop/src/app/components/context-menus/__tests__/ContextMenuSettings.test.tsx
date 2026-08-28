import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";

import { DEFAULT_PREFERENCES } from "@/app/preferences";
import { sourceSelected } from "@/app/store/actions/source-actions";
import { selectMergeAudio } from "@/app/store/slices/audio-slice";
import { createAppStore } from "@/app/store/store";

import { ContextMenuSettings } from "../components/ContextMenuSettings";

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
      <TooltipProvider delayDuration={0}>
        <ContextMenuSettings navigation={navigation} />
      </TooltipProvider>
    </Provider>,
  );
  return store;
}

describe("ContextMenuSettings Redux integration", () => {
  it("dispatches preference changes through Redux", async () => {
    const user = userEvent.setup();
    const store = renderSettings();

    const loopRow = screen.getByRole("menuitem", { name: "Loop" });
    await user.click(within(loopRow).getByRole("switch"));

    expect(store.getState().preferences.loopPlaybackEnabledDefault).toBe(false);
  });

  it("shows queue auto start enabled by default and updates its preference", async () => {
    const user = userEvent.setup();
    const store = renderSettings();
    const autoStartQueueSwitch = within(
      screen.getByRole("menuitem", { name: "Auto-start Queue" }),
    ).getByRole("switch");

    expect(autoStartQueueSwitch).toBeChecked();

    await user.click(autoStartQueueSwitch);

    expect(store.getState().preferences.autoStartQueueEnabled).toBe(false);
  });

  it("keeps an open preference tooltip visible and updates its label after toggling", async () => {
    const user = userEvent.setup();
    renderSettings();
    const loopRow = screen.getByRole("menuitem", { name: "Loop" });

    await user.hover(loopRow);
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Enabled by default");

    await user.click(within(loopRow).getByRole("switch"));

    expect(screen.getByRole("tooltip")).toHaveTextContent("Disabled by default");
  });

  it("allows a preference tooltip to close after the trigger interaction finishes", async () => {
    const user = userEvent.setup();
    renderSettings();
    const loopRow = screen.getByRole("menuitem", { name: "Loop" });
    const loopSwitch = within(loopRow).getByRole("switch");

    await user.hover(loopRow);
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Enabled by default");

    await user.click(loopSwitch);
    fireEvent.blur(loopRow, { relatedTarget: loopSwitch });

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("resets preferences without rewriting active editor tools", async () => {
    const user = userEvent.setup();
    const store = renderSettings();

    const loopSwitch = within(screen.getByRole("menuitem", { name: "Loop" })).getByRole("switch");
    await user.click(loopSwitch);
    expect(store.getState().preferences.loopPlaybackEnabledDefault).toBe(false);
    expect(store.getState().editorTools.loopPlaybackEnabled).toBe(true);
    await user.click(screen.getByRole("menuitem", { name: "Reset to default" }));

    expect(store.getState().preferences).toEqual(DEFAULT_PREFERENCES);
    expect(store.getState().editorTools.loopPlaybackEnabled).toBe(true);
  });

  it("does not rewrite active audio tools when the merge default changes", async () => {
    const user = userEvent.setup();
    const store = renderSettings();
    store.dispatch(
      sourceSelected({
        source: {
          displayName: "source.mp4",
          sourcePath: "C:/Media/source.mp4",
        },
        mergeAudio: true,
      }),
    );

    expect(selectMergeAudio(store.getState())).toBe(true);

    const mergeSwitch = within(screen.getByRole("menuitem", { name: "Merge audio" })).getByRole(
      "switch",
    );

    await user.click(mergeSwitch);

    expect(store.getState().preferences.mergeAudioEnabledDefault).toBe(true);
    expect(selectMergeAudio(store.getState())).toBe(true);

    await user.click(screen.getByRole("menuitem", { name: "Reset to default" }));

    expect(store.getState().preferences).toEqual(DEFAULT_PREFERENCES);
    expect(selectMergeAudio(store.getState())).toBe(true);
  });
});

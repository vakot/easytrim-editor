import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { describe, expect, it } from "vitest";

import { Menubar } from "@/components/ui/menubar";
import { TooltipProvider } from "@/components/ui/tooltip";

import { DEFAULT_PREFERENCES } from "@/app/preferences";
import { sourceSelected } from "@/app/store/actions/source-actions";
import { selectMergeAudio } from "@/app/store/slices/audio-slice";
import { createAppStore } from "@/app/store/store";

import { MenuBarSettings } from "../MenuBarSettings";

function renderSettings() {
  const store = createAppStore();
  render(
    <Provider store={store}>
      <TooltipProvider delayDuration={0}>
        <Menubar value="settings">
          <MenuBarSettings />
        </Menubar>
      </TooltipProvider>
    </Provider>,
  );
  return store;
}

describe("MenuBarSettings Redux integration", () => {
  it("dispatches preference changes through Redux", async () => {
    const user = userEvent.setup();
    const store = renderSettings();

    const loopItem = screen.getByRole("menuitemcheckbox", { name: "Loop" });
    await user.click(loopItem);

    expect(store.getState().preferences.loopPlaybackEnabledDefault).toBe(false);
  });

  it("shows queue auto start enabled by default and updates its preference", async () => {
    const user = userEvent.setup();
    const store = renderSettings();
    const autoStartQueueItem = screen.getByRole("menuitemcheckbox", {
      name: "Auto-start Queue",
    });

    expect(autoStartQueueItem).toBeChecked();

    await user.click(autoStartQueueItem);

    expect(store.getState().preferences.autoStartQueueEnabled).toBe(false);
  });

  it("keeps an open preference tooltip visible and updates its label after toggling", async () => {
    const user = userEvent.setup();
    renderSettings();
    const loopItem = screen.getByRole("menuitemcheckbox", { name: "Loop" });

    await user.hover(loopItem);
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Enabled by default");

    await user.click(loopItem);

    expect(screen.getByRole("tooltip")).toHaveTextContent("Disabled by default");
  });

  it("allows a preference tooltip to close after the trigger interaction finishes", async () => {
    const user = userEvent.setup();
    renderSettings();
    const loopItem = screen.getByRole("menuitemcheckbox", { name: "Loop" });

    await user.hover(loopItem);
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Enabled by default");

    await user.click(loopItem);
    fireEvent.blur(loopItem);

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("resets preferences without rewriting active editor tools", async () => {
    const user = userEvent.setup();
    const store = renderSettings();

    const loopItem = screen.getByRole("menuitemcheckbox", { name: "Loop" });
    await user.click(loopItem);
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

    const mergeItem = screen.getByRole("menuitemcheckbox", { name: "Merge audio" });

    await user.click(mergeItem);

    expect(store.getState().preferences.mergeAudioEnabledDefault).toBe(true);
    expect(selectMergeAudio(store.getState())).toBe(true);

    await user.click(screen.getByRole("menuitem", { name: "Reset to default" }));

    expect(store.getState().preferences).toEqual(DEFAULT_PREFERENCES);
    expect(selectMergeAudio(store.getState())).toBe(true);
  });
});

import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { describe, expect, it, vi } from "vitest";

import { Menubar } from "@/components/ui/menubar";
import { TooltipProvider } from "@/components/ui/tooltip";

import { DEFAULT_PREFERENCES } from "@/app/preferences";
import { ApplicationCommandsProvider } from "@/app/providers/ApplicationCommandsProvider";
import { sourceSelected } from "@/app/store/actions/source-actions";
import { selectMergeAudio } from "@/app/store/slices/audio-slice";
import {
  activityFeedViewChanged,
  layoutDensityChanged,
} from "@/app/store/slices/preferences-slice";
import { createAppStore } from "@/app/store/store";

import { MenuBarSettings } from "../MenuBarSettings";

vi.mock("@/features/changelog", () => ({ useChangelogDialog: () => ({ openChangelog: vi.fn() }) }));
vi.mock("@/features/export", () => ({
  useQueueDeleteSource: () => ({ requestEnableSourceDeletion: vi.fn() }),
}));
vi.mock("@/features/preview", () => ({
  usePreviewTransform: () => ({ isAvailable: false, requestCrop: vi.fn(), requestReset: vi.fn() }),
}));
vi.mock("@/features/source", () => ({ useSourceDelete: () => ({ requestSourceDelete: vi.fn() }) }));
vi.mock("@/app/hooks/useAppUpdates", () => ({
  useAppUpdates: () => ({
    availableVersion: null,
    checkForUpdates: vi.fn(),
    installUpdate: vi.fn(),
    isInstalling: false,
    status: "idle",
  }),
}));
vi.mock("@/components/ui/resizable", async () => {
  const actual = await vi.importActual<typeof import("@/components/ui/resizable")>(
    "@/components/ui/resizable",
  );

  return {
    ...actual,
    usePanelCommand: () => ({
      isAvailable: true,
      isCollapsed: false,
      isDisabled: false,
      isReset: false,
      toggle: vi.fn(),
      reset: vi.fn(),
    }),
  };
});

function renderSettings() {
  const store = createAppStore();
  render(
    <Provider store={store}>
      <TooltipProvider delayDuration={0}>
        <ApplicationCommandsProvider>
          <Menubar value="settings">
            <MenuBarSettings />
          </Menubar>
        </ApplicationCommandsProvider>
      </TooltipProvider>
    </Provider>,
  );
  return store;
}

describe("MenuBarSettings Redux integration", () => {
  it("dispatches preference changes through Redux", async () => {
    const user = userEvent.setup();
    const store = renderSettings();

    const loopItem = screen.getByRole("menuitemcheckbox", {
      name: "Loop",
    });

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
    const loopItem = screen.getByRole("menuitemcheckbox", {
      name: "Loop",
    });

    await user.hover(loopItem);
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Enabled by default");

    await user.click(loopItem);

    expect(screen.getByRole("tooltip")).toHaveTextContent("Disabled by default");
  });

  it("allows a preference tooltip to close after the trigger interaction finishes", async () => {
    const user = userEvent.setup();
    renderSettings();
    const loopItem = screen.getByRole("menuitemcheckbox", {
      name: "Loop",
    });

    await user.hover(loopItem);
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Enabled by default");

    await user.click(loopItem);
    fireEvent.blur(loopItem);

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("resets preferences without rewriting active editor tools", async () => {
    const user = userEvent.setup();
    const store = renderSettings();
    store.dispatch(activityFeedViewChanged("branch"));
    store.dispatch(layoutDensityChanged("compact"));
    const resetItem = screen.getByRole("menuitem", { name: "Reset to default" });
    expect(resetItem).toHaveAttribute("aria-disabled", "true");

    const loopItem = screen.getByRole("menuitemcheckbox", {
      name: "Loop",
    });

    await user.click(loopItem);
    expect(store.getState().preferences.loopPlaybackEnabledDefault).toBe(false);
    expect(store.getState().editorTools.loopPlaybackEnabled).toBe(true);
    expect(resetItem).not.toHaveAttribute("aria-disabled", "true");
    await user.click(resetItem);

    expect(store.getState().preferences).toEqual({
      ...DEFAULT_PREFERENCES,
      activityFeedView: "branch",
      layoutDensity: "compact",
    });
    expect(store.getState().editorTools.loopPlaybackEnabled).toBe(true);
    expect(resetItem).toHaveAttribute("aria-disabled", "true");
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

    const mergeItem = screen.getByRole("menuitemcheckbox", {
      name: "Merge audio",
    });

    await user.click(mergeItem);

    expect(store.getState().preferences.mergeAudioEnabledDefault).toBe(true);
    expect(selectMergeAudio(store.getState())).toBe(true);

    await user.click(screen.getByRole("menuitem", { name: "Reset to default" }));

    expect(store.getState().preferences).toEqual(DEFAULT_PREFERENCES);
    expect(selectMergeAudio(store.getState())).toBe(true);
  });
});

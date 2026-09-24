import { act, render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { describe, expect, it } from "vitest";

import { CommandPaletteProvider } from "@/app/providers/CommandPaletteProvider";
import { capabilitiesChecking, capabilitiesReady } from "@/app/store/slices/source-slice";
import { createAppStore } from "@/app/store/store";
import type { MediaCapabilities } from "@/lib/tauri/media.types";

import { AppTitleBarCommandCenter } from "../AppTitleBarCommandCenter";

const capabilities: MediaCapabilities = {
  ffmpeg: { available: true, version: "ffmpeg version 7.1" },
  ffprobe: { available: true, version: "ffprobe version 7.1" },
};

describe("AppTitleBarCommandCenter", () => {
  it("shows startup status first and keeps Search visible through later checks", async () => {
    const store = createAppStore();
    render(
      <Provider store={store}>
        <CommandPaletteProvider>
          <AppTitleBarCommandCenter />
        </CommandPaletteProvider>
      </Provider>,
    );

    expect(screen.getByRole("button", { name: "Checking media tools…" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Search commands…" })).not.toBeInTheDocument();

    act(() => store.dispatch(capabilitiesReady(capabilities)));
    expect(await screen.findByRole("button", { name: "Media tools ready" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Search commands…" })).not.toBeInTheDocument();

    const search = await screen.findByRole("button", { name: "Search commands…" });
    act(() => store.dispatch(capabilitiesChecking()));
    await waitFor(() => expect(search).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Checking media tools…" })).toBeInTheDocument();
  });
});

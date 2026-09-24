import { act, render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CommandPaletteProvider } from "@/app/providers/CommandPaletteProvider";
import { capabilitiesChecking, capabilitiesReady } from "@/app/store/slices/source-slice";
import { createAppStore } from "@/app/store/store";
import type { MediaCapabilities } from "@/lib/tauri/media.types";

import { AppCommandCenter } from "../AppCommandCenter";

const capabilities: MediaCapabilities = {
  ffmpeg: { available: true, version: "ffmpeg version 7.1" },
  ffprobe: { available: true, version: "ffprobe version 7.1" },
};

describe("AppCommandCenter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows startup status first and keeps Search visible through later checks", () => {
    const store = createAppStore();
    render(
      <Provider store={store}>
        <CommandPaletteProvider>
          <AppCommandCenter />
        </CommandPaletteProvider>
      </Provider>,
    );

    expect(screen.getByRole("button", { name: "Checking media tools…" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Search commands…" })).not.toBeInTheDocument();

    act(() => store.dispatch(capabilitiesReady(capabilities)));
    expect(screen.getByRole("button", { name: "Media tools ready" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Search commands…" })).not.toBeInTheDocument();

    act(() => vi.advanceTimersByTime(799));
    expect(screen.queryByRole("button", { name: "Search commands…" })).not.toBeInTheDocument();

    act(() => vi.advanceTimersByTime(1));
    const search = screen.getByRole("button", { name: "Search commands…" });
    act(() => store.dispatch(capabilitiesChecking()));
    expect(search).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Checking media tools…" })).toBeInTheDocument();
  });
});

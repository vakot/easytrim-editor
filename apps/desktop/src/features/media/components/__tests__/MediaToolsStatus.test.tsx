import { fireEvent, render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { beforeEach, describe, expect, it, vi } from "vitest";

const native = vi.hoisted(() => ({ checkMediaCapabilities: vi.fn() }));

vi.mock("@/lib/tauri/media", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tauri/media")>()),
  checkMediaCapabilities: native.checkMediaCapabilities,
}));

import { capabilitiesFailed, capabilitiesReady } from "@/app/store/slices/source-slice";
import { createAppStore } from "@/app/store/store";
import type { MediaCapabilities } from "@/lib/tauri/media.types";

import { MediaToolsStatus } from "../MediaToolsStatus";

const readyCapabilities: MediaCapabilities = {
  ffmpeg: {
    available: true,
    path: "C:/Tools/ffmpeg.exe",
    version: "ffmpeg version 7.1",
  },
  ffprobe: {
    available: true,
    path: "C:/Tools/ffprobe.exe",
    version: "ffprobe version 7.1",
  },
};

function renderStatus(capabilities?: MediaCapabilities) {
  const store = createAppStore();
  if (capabilities) store.dispatch(capabilitiesReady(capabilities));
  return {
    store,
    ...render(
      <Provider store={store}>
        <MediaToolsStatus />
      </Provider>,
    ),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("MediaToolsStatus", () => {
  it("shows checking while a check is active and disables Recheck", async () => {
    renderStatus();

    const trigger = screen.getByRole("button", { name: "Checking media tools…" });
    fireEvent.click(trigger);

    expect(screen.getByRole("button", { name: "Checking…" })).toBeDisabled();
  });

  it("shows both versions and resolved paths when ready without recovery instructions", () => {
    renderStatus(readyCapabilities);
    const trigger = screen.getByRole("button", { name: "Media tools ready" });
    fireEvent.click(trigger);

    expect(trigger.querySelector('svg[aria-hidden="true"]')).toHaveClass("lucide-circle-check");
    expect(screen.getByText("ffmpeg version 7.1")).toBeInTheDocument();
    expect(screen.getByText("ffprobe version 7.1")).toBeInTheDocument();
    expect(screen.getByText("C:/Tools/ffmpeg.exe")).toBeInTheDocument();
    expect(screen.getByText("C:/Tools/ffprobe.exe")).toBeInTheDocument();
    expect(screen.queryByText("Install on Windows")).not.toBeInTheDocument();
  });

  it("shows recovery for partial availability and disables duplicate checks in flight", async () => {
    native.checkMediaCapabilities.mockImplementation(
      () => new Promise<MediaCapabilities>(() => {}),
    );
    const partial: MediaCapabilities = {
      ffmpeg: readyCapabilities.ffmpeg,
      ffprobe: { available: false, error: "ffprobe is not available on PATH." },
    };

    renderStatus(partial);
    fireEvent.click(screen.getByRole("button", { name: "Media tools issue" }));

    expect(screen.getByText("FFmpeg and FFprobe normally ship together.")).toBeInTheDocument();
    expect(screen.getByText("winget install --id Gyan.FFmpeg --exact")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Recheck" }));
    expect(await screen.findByRole("button", { name: "Checking…" })).toBeDisabled();
    expect(native.checkMediaCapabilities).toHaveBeenCalledTimes(1);
  });

  it("shows check failure distinctly and allows a failed capability check to be retried", () => {
    const store = createAppStore();
    store.dispatch(capabilitiesFailed({ code: "internal", message: "Capability check failed." }));
    render(
      <Provider store={store}>
        <MediaToolsStatus />
      </Provider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Media tools check failed" }));

    expect(screen.getByText("Capability check failed.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Recheck" })).toBeEnabled();
    expect(screen.queryByText("Install on Windows")).not.toBeInTheDocument();
  });
});

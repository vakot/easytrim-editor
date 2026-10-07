import { fireEvent, render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const native = vi.hoisted(() => ({ checkMediaCapabilities: vi.fn() }));

vi.mock("@/lib/tauri/media", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tauri/media")>()),
  checkMediaCapabilities: native.checkMediaCapabilities,
}));

import { capabilitiesFailed, capabilitiesReady } from "@/app/store/slices/source-slice";
import { createAppStore } from "@/app/store/store";
import { i18n } from "@/i18n/config";
import type { MediaCapabilities } from "@/lib/tauri/media.types";

import {
  MediaToolsStatus,
  MediaToolsStatusContent,
  MediaToolsStatusTrigger,
} from "../MediaToolsStatus";

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
        <MediaToolsStatus>
          <MediaToolsStatusTrigger presentation="default" />
          <MediaToolsStatusContent />
        </MediaToolsStatus>
      </Provider>,
    ),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(async () => {
  await i18n.changeLanguage("en");
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
      ffprobe: { available: false, errorId: "notFound" },
    };

    renderStatus(partial);
    fireEvent.click(screen.getByRole("button", { name: "Media tools issue" }));

    expect(screen.getByText("FFmpeg and FFprobe normally ship together.")).toBeInTheDocument();
    expect(screen.getByText("winget install --id Gyan.FFmpeg --exact")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Recheck" }));
    expect(await screen.findByRole("button", { name: "Checking…" })).toBeDisabled();
    expect(native.checkMediaCapabilities).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["notFound", "FFmpeg is not installed or available on PATH."],
    ["timedOut", "FFmpeg did not respond within 3 seconds."],
    ["startFailed", "Could not start FFmpeg."],
    ["checkFailed", "Could not check FFmpeg."],
  ] as const)(
    "localizes the %s capability failure without showing diagnostics",
    (errorId, copy) => {
      renderStatus({
        ffmpeg: { available: false, diagnostics: "C:/private/ffmpeg.exe: private stderr", errorId },
        ffprobe: readyCapabilities.ffprobe,
      });
      fireEvent.click(screen.getByRole("button"));

      expect(screen.getByText(copy)).toBeInTheDocument();
      expect(screen.queryByText("C:/private/ffmpeg.exe: private stderr")).not.toBeInTheDocument();
    },
  );

  it("interpolates the FFprobe label and safely handles an unknown error ID", () => {
    renderStatus({
      ffmpeg: readyCapabilities.ffmpeg,
      ffprobe: {
        available: false,
        diagnostics: "C:/private/ffprobe.exe: private stderr",
        errorId: undefined,
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Media tools issue" }));

    expect(screen.getByText("Could not check FFprobe.")).toBeInTheDocument();
    expect(screen.queryByText("C:/private/ffprobe.exe: private stderr")).not.toBeInTheDocument();
  });

  it.each(["ru"] as const)("shows localized capability copy in %s", async (language) => {
    await i18n.changeLanguage(language);
    renderStatus({
      ffmpeg: { available: false, errorId: "notFound" },
      ffprobe: readyCapabilities.ffprobe,
    });
    fireEvent.click(screen.getByRole("button"));

    expect(screen.getByText("FFmpeg не установлен или недоступен в PATH.")).toBeInTheDocument();
  });

  it("shows check failure distinctly and allows a failed capability check to be retried", () => {
    const store = createAppStore();
    store.dispatch(
      capabilitiesFailed({ code: "internal", diagnostics: "Capability check failed." }),
    );
    render(
      <Provider store={store}>
        <MediaToolsStatus>
          <MediaToolsStatusTrigger presentation="default" />
          <MediaToolsStatusContent />
        </MediaToolsStatus>
      </Provider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Media tools check failed" }));

    expect(screen.getByText("An unexpected application error occurred.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Recheck" })).toBeEnabled();
    expect(screen.queryByText("Install on Windows")).not.toBeInTheDocument();
  });
});

import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  MediaCapabilities,
  MediaInfo,
  SourceImportEvent,
  SourceSelection,
} from "./lib/tauri/media";

const mocks = vi.hoisted(() => ({
  checkMediaCapabilities: vi.fn(),
  chooseSource: vi.fn(),
  inspectMedia: vi.fn(),
  listenForSourceImports: vi.fn(),
  unlisten: vi.fn(),
}));

vi.mock("./lib/tauri/media", async (importOriginal) => {
  const original = await importOriginal<typeof import("./lib/tauri/media")>();
  return {
    ...original,
    checkMediaCapabilities: mocks.checkMediaCapabilities,
    chooseSource: mocks.chooseSource,
    inspectMedia: mocks.inspectMedia,
    listenForSourceImports: mocks.listenForSourceImports,
  };
});

import App from "./App";

const capabilities: MediaCapabilities = {
  ffmpeg: { available: true, version: "ffmpeg version 7.1" },
  ffprobe: { available: true, version: "ffprobe version 7.1" },
};

const selection: SourceSelection = {
  sourceId: "source-1",
  displayName: "holiday.mp4",
};

const media: MediaInfo = {
  sourceId: selection.sourceId,
  formatName: "mov,mp4,m4a,3gp,3g2,mj2",
  formatLongName: "QuickTime / MOV",
  durationMicros: 65_000_000,
  sizeBytes: 25_000_000,
  bitrate: 3_076_923,
  video: {
    streamIndex: 0,
    codecName: "h264",
    width: 3840,
    height: 2160,
    averageFrameRate: {
      numerator: 60_000,
      denominator: 1_001,
      displayValue: 59.940_059_940_059_94,
    },
  },
  audioStreams: [
    {
      streamIndex: 1,
      codecName: "aac",
      channels: 2,
      channelLayout: "stereo",
      sampleRateHz: 48_000,
      language: "eng",
      isDefault: true,
    },
  ],
  chapters: [],
};

let sourceImportListener: ((event: SourceImportEvent) => void) | undefined;

beforeEach(() => {
  vi.clearAllMocks();
  sourceImportListener = undefined;
  mocks.checkMediaCapabilities.mockResolvedValue(capabilities);
  mocks.chooseSource.mockResolvedValue(null);
  mocks.inspectMedia.mockResolvedValue(media);
  mocks.listenForSourceImports.mockImplementation(
    async (listener: (event: SourceImportEvent) => void) => {
      sourceImportListener = listener;
      return mocks.unlisten;
    },
  );
});

describe("App", () => {
  it("imports a selected video and renders source metadata", async () => {
    mocks.chooseSource.mockResolvedValue(selection);
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Open video" }));

    expect(await screen.findByRole("heading", { name: "holiday.mp4" })).toBeInTheDocument();
    expect(await screen.findByText("3840 × 2160")).toBeInTheDocument();
    expect(screen.getByText("59.94 fps")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Audio streams" })).toBeInTheDocument();
    expect(screen.getByText(/AAC/)).toBeInTheDocument();
  });

  it("keeps the current source when the picker is cancelled", async () => {
    mocks.chooseSource.mockResolvedValueOnce(selection).mockResolvedValueOnce(null);
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Open video" }));
    expect(await screen.findByRole("heading", { name: "holiday.mp4" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Open another video" }));

    expect(screen.getByRole("heading", { name: "holiday.mp4" })).toBeInTheDocument();
    expect(mocks.inspectMedia).toHaveBeenCalledTimes(1);
  });

  it("shows a clear missing-binary capability state", async () => {
    mocks.checkMediaCapabilities.mockResolvedValue({
      ffmpeg: { available: false, error: "ffmpeg is not installed or available on PATH." },
      ffprobe: { available: false, error: "ffprobe is not installed or available on PATH." },
    });
    render(<App />);

    expect(await screen.findByText("Media tools unavailable")).toBeInTheDocument();
    expect(screen.getByText(/FFprobe: ffprobe is not installed/)).toBeInTheDocument();
  });

  it("replaces the current source with a failed dropped import", async () => {
    mocks.chooseSource.mockResolvedValue(selection);
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Open video" }));
    expect(await screen.findByRole("heading", { name: "holiday.mp4" })).toBeInTheDocument();

    act(() => {
      sourceImportListener?.({
        status: "failed",
        error: { code: "unsupported_media", message: "This file type is not supported yet." },
      });
    });

    expect(screen.queryByRole("heading", { name: "holiday.mp4" })).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("This file type is not supported yet.");
  });

  it("cleans up the native drop listener on unmount", async () => {
    const view = render(<App />);
    await waitFor(() => expect(sourceImportListener).toBeDefined());

    view.unmount();

    expect(mocks.unlisten).toHaveBeenCalledOnce();
  });
});

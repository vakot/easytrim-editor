import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  MediaCapabilities,
  MediaInfo,
  SourceDragEvent,
  SourceImportEvent,
  SourceSelection,
} from "./lib/tauri/media";

const mocks = vi.hoisted(() => ({
  checkMediaCapabilities: vi.fn(),
  chooseSource: vi.fn(),
  inspectMedia: vi.fn(),
  listenForSourceDrag: vi.fn(),
  listenForSourceImports: vi.fn(),
  unlistenDrag: vi.fn(),
  unlistenImport: vi.fn(),
}));

vi.mock("./lib/tauri/media", async (importOriginal) => {
  const original = await importOriginal<typeof import("./lib/tauri/media")>();
  return {
    ...original,
    checkMediaCapabilities: mocks.checkMediaCapabilities,
    chooseSource: mocks.chooseSource,
    inspectMedia: mocks.inspectMedia,
    listenForSourceDrag: mocks.listenForSourceDrag,
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
let sourceDragListener: ((event: SourceDragEvent) => void) | undefined;

beforeEach(() => {
  vi.clearAllMocks();
  sourceImportListener = undefined;
  sourceDragListener = undefined;
  mocks.checkMediaCapabilities.mockResolvedValue(capabilities);
  mocks.chooseSource.mockResolvedValue(null);
  mocks.inspectMedia.mockResolvedValue(media);
  mocks.listenForSourceImports.mockImplementation(
    async (listener: (event: SourceImportEvent) => void) => {
      sourceImportListener = listener;
      return mocks.unlistenImport;
    },
  );
  mocks.listenForSourceDrag.mockImplementation(
    async (listener: (event: SourceDragEvent) => void) => {
      sourceDragListener = listener;
      return mocks.unlistenDrag;
    },
  );
});

describe("App", () => {
  it("starts with a full workspace import view", async () => {
    render(<App />);

    expect(screen.getByText("Local video editor")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Easy Cut" })).toBeInTheDocument();
    expect(
      screen.getByText("Import a video to inspect its source and prepare a precise cut."),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Open a video" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Select video" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Video editor workspace")).not.toBeInTheDocument();
  });

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
    expect(screen.getByLabelText("Video preview and timeline area")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Open a video" })).not.toBeInTheDocument();
    expect(screen.queryByText("Local video editor")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Import a video to inspect its source and prepare a precise cut."),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("toolbar", { name: "Application toolbar" })).toBeInTheDocument();
  });

  it("keeps the current source when the picker is cancelled", async () => {
    mocks.chooseSource.mockResolvedValueOnce(selection).mockResolvedValueOnce(null);
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Open video" }));
    expect(await screen.findByRole("heading", { name: "holiday.mp4" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Open video" }));

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
    expect(
      screen.getByRole("status", { name: /FFprobe: ffprobe is not installed/ }),
    ).toBeInTheDocument();
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

  it("shows the native drag overlay over the editor stage", async () => {
    mocks.chooseSource.mockResolvedValue(selection);
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Open video" }));
    expect(await screen.findByRole("heading", { name: "holiday.mp4" })).toBeInTheDocument();

    act(() => sourceDragListener?.({ active: true }));
    expect(screen.getByRole("status", { name: "Drop video to open" })).toBeInTheDocument();

    act(() => sourceDragListener?.({ active: false }));
    expect(screen.queryByRole("status", { name: "Drop video to open" })).not.toBeInTheDocument();
  });

  it("cleans up native source listeners on unmount", async () => {
    const view = render(<App />);
    await waitFor(() => {
      expect(sourceImportListener).toBeDefined();
      expect(sourceDragListener).toBeDefined();
    });

    view.unmount();

    expect(mocks.unlistenImport).toHaveBeenCalledOnce();
    expect(mocks.unlistenDrag).toHaveBeenCalledOnce();
  });
});

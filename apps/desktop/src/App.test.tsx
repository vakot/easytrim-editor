import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  MediaCapabilities,
  MediaInfo,
  SourceDropEvent,
  SourceSelection,
} from "./lib/tauri/media";

const mocks = vi.hoisted(() => ({
  checkMediaCapabilities: vi.fn(),
  chooseSource: vi.fn(),
  inspectMedia: vi.fn(),
  listenForSourceDrops: vi.fn(),
  prepareProxyPreview: vi.fn(),
  prepareSourcePreview: vi.fn(),
  unlistenDrops: vi.fn(),
}));

vi.mock("./lib/tauri/media", async (importOriginal) => {
  const original = await importOriginal<typeof import("./lib/tauri/media")>();
  return {
    ...original,
    checkMediaCapabilities: mocks.checkMediaCapabilities,
    chooseSource: mocks.chooseSource,
    inspectMedia: mocks.inspectMedia,
    listenForSourceDrops: mocks.listenForSourceDrops,
    prepareProxyPreview: mocks.prepareProxyPreview,
    prepareSourcePreview: mocks.prepareSourcePreview,
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

let sourceDropListener: ((event: SourceDropEvent) => void) | undefined;

beforeEach(() => {
  vi.clearAllMocks();
  sourceDropListener = undefined;
  mocks.checkMediaCapabilities.mockResolvedValue(capabilities);
  mocks.chooseSource.mockResolvedValue(null);
  mocks.inspectMedia.mockResolvedValue(media);
  mocks.prepareSourcePreview.mockResolvedValue({
    sourceId: selection.sourceId,
    url: "http://clipkit-media.localhost/source-1?variant=source",
    kind: "source",
  });
  mocks.prepareProxyPreview.mockResolvedValue({
    sourceId: selection.sourceId,
    url: "http://clipkit-media.localhost/source-1?variant=proxy",
    kind: "proxy",
  });
  mocks.listenForSourceDrops.mockImplementation(
    async (listener: (event: SourceDropEvent) => void) => {
      sourceDropListener = listener;
      return mocks.unlistenDrops;
    },
  );
});

describe("App", () => {
  it("starts with a full workspace import view", async () => {
    render(<App />);

    expect(screen.getByText("Local video editor")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "ClipKit" })).toBeInTheDocument();
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
    expect(screen.getByLabelText("Source video preview")).toHaveAttribute(
      "src",
      "http://clipkit-media.localhost/source-1?variant=source",
    );
    expect(screen.getByLabelText("Source video preview")).not.toHaveAttribute("controls");
    expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous frame" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next frame" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Set segment start to current position" }),
    ).toHaveAttribute("aria-keyshortcuts", "I");
    expect(
      screen.getByRole("button", { name: "Set segment end to current position" }),
    ).toHaveAttribute("aria-keyshortcuts", "O");
    expect(screen.getByLabelText("Current playback time")).toHaveTextContent(
      "00:00:00.000 / 00:01:05.000",
    );
    const timelineHeading = screen.getByRole("heading", {
      name: "Selected Segment",
    }).parentElement?.parentElement;
    expect(timelineHeading).not.toBeNull();
    expect(within(timelineHeading as HTMLElement).getByLabelText("Current playback time")).toBe(
      screen.getByLabelText("Current playback time"),
    );
    expect(
      within(timelineHeading as HTMLElement).getByLabelText("Preview playback controls"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Trim" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Video preview and timeline area")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Open a video" })).not.toBeInTheDocument();
    expect(screen.queryByText("Local video editor")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Import a video to inspect its source and prepare a precise cut."),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("toolbar", { name: "Application toolbar" })).toBeInTheDocument();
  });

  it("plays, pauses, and steps by the source fractional frame rate", async () => {
    mocks.chooseSource.mockResolvedValue(selection);
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Open video" }));
    const video = (await screen.findByLabelText("Source video preview")) as HTMLVideoElement;
    const play = vi.spyOn(video, "play").mockResolvedValue();
    const pause = vi.spyOn(video, "pause").mockImplementation(() => undefined);

    await user.click(screen.getByRole("button", { name: "Play" }));
    expect(play).toHaveBeenCalledOnce();

    fireEvent.play(video);
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Next frame" }));
    expect(pause).toHaveBeenCalled();
    expect(screen.getByRole("slider", { name: "Playback position" })).toHaveAttribute(
      "aria-valuenow",
      "16683",
    );
    expect(screen.getByLabelText("Current playback time")).toHaveTextContent("00:00:00.016");

    await user.click(screen.getByRole("button", { name: "Previous frame" }));
    expect(screen.getByLabelText("Current playback time")).toHaveTextContent("00:00:00.000");
  });

  it("prioritizes playback while keeping other shortcuts locked during text entry", async () => {
    mocks.chooseSource.mockResolvedValue(selection);
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Open video" }));
    const video = (await screen.findByLabelText("Source video preview")) as HTMLVideoElement;
    const play = vi.spyOn(video, "play").mockResolvedValue();
    const pause = vi.spyOn(video, "pause").mockImplementation(() => undefined);

    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(screen.getByRole("slider", { name: "Playback position" })).toHaveAttribute(
      "aria-valuenow",
      "16683",
    );

    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(screen.getByRole("slider", { name: "Playback position" })).toHaveAttribute(
      "aria-valuenow",
      "0",
    );

    fireEvent.keyDown(window, { key: " " });
    expect(play).toHaveBeenCalledOnce();
    fireEvent.play(video);
    pause.mockClear();
    fireEvent.keyDown(window, { key: " " });
    expect(pause).toHaveBeenCalledOnce();
    fireEvent.pause(video);

    const input = document.createElement("input");
    document.body.append(input);
    input.focus();
    play.mockClear();
    pause.mockClear();
    fireEvent.keyDown(input, { key: " " });
    fireEvent.keyDown(input, { key: "ArrowRight" });
    expect(play).toHaveBeenCalledOnce();
    expect(pause).not.toHaveBeenCalled();
    expect(screen.getByRole("slider", { name: "Playback position" })).toHaveAttribute(
      "aria-valuenow",
      "0",
    );
    input.remove();
  });

  it("removes the editor shortcut listener when the preview unmounts", async () => {
    mocks.chooseSource.mockResolvedValue(selection);
    const removeEventListener = vi.spyOn(window, "removeEventListener");
    const user = userEvent.setup();
    const view = render(<App />);

    await user.click(screen.getByRole("button", { name: "Open video" }));
    await screen.findByLabelText("Source video preview");
    view.unmount();

    expect(removeEventListener).toHaveBeenCalledWith("keydown", expect.any(Function), true);
    removeEventListener.mockRestore();
  });

  it("sets segment boundaries at the playhead with crossing and edge safeguards", async () => {
    mocks.chooseSource.mockResolvedValue(selection);
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Open video" }));
    const video = (await screen.findByLabelText("Source video preview")) as HTMLVideoElement;
    const startHandle = screen.getByRole("slider", { name: "Trim start" });
    const endHandle = screen.getByRole("slider", { name: "Trim end" });
    const setStart = screen.getByRole("button", {
      name: "Set segment start to current position",
    });
    const setEnd = screen.getByRole("button", {
      name: "Set segment end to current position",
    });

    expect(setEnd).toBeDisabled();

    video.currentTime = 10;
    fireEvent.timeUpdate(video);
    fireEvent.keyDown(window, { key: "i" });
    expect(startHandle).toHaveAttribute("aria-valuenow", "10000000");

    video.currentTime = 5;
    fireEvent.timeUpdate(video);
    fireEvent.keyDown(window, { key: "o" });
    expect(startHandle).toHaveAttribute("aria-valuenow", "0");
    expect(endHandle).toHaveAttribute("aria-valuenow", "5000000");

    video.currentTime = 20;
    fireEvent.timeUpdate(video);
    await user.click(setStart);
    expect(startHandle).toHaveAttribute("aria-valuenow", "20000000");
    expect(endHandle).toHaveAttribute("aria-valuenow", "65000000");

    video.currentTime = 15;
    fireEvent.timeUpdate(video);
    await user.click(setEnd);
    expect(startHandle).toHaveAttribute("aria-valuenow", "0");
    expect(endHandle).toHaveAttribute("aria-valuenow", "15000000");

    video.currentTime = 65;
    fireEvent.timeUpdate(video);
    expect(setStart).toBeDisabled();
    video.currentTime = 0;
    fireEvent.timeUpdate(video);
    expect(setEnd).toBeDisabled();
  });

  it("falls back to a compatible proxy when direct playback fails", async () => {
    mocks.chooseSource.mockResolvedValue(selection);
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Open video" }));
    const directPreview = await screen.findByLabelText("Source video preview");
    fireEvent.error(directPreview);

    await waitFor(() => {
      expect(mocks.prepareProxyPreview).toHaveBeenCalledWith(selection.sourceId);
    });
    expect(await screen.findByText("720p preview")).toBeInTheDocument();
    expect(screen.getByLabelText("Source video preview")).toHaveAttribute(
      "src",
      "http://clipkit-media.localhost/source-1?variant=proxy",
    );
  });

  it("exposes keyboard-accessible trim handles and updates the source range", async () => {
    mocks.chooseSource.mockResolvedValue(selection);
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Open video" }));
    const startHandle = await screen.findByRole("slider", { name: "Trim start" });
    const endHandle = screen.getByRole("slider", { name: "Trim end" });

    expect(startHandle).toHaveAttribute("aria-valuenow", "0");
    expect(endHandle).toHaveAttribute("aria-valuenow", "65000000");

    await user.click(startHandle);
    await user.keyboard("{ArrowRight}");

    expect(startHandle).toHaveAttribute("aria-valuenow", "16683");
    expect(screen.getAllByText("00:00:00.016")).not.toHaveLength(0);
  });

  it("maps pointer movement on a trim handle to source time", async () => {
    mocks.chooseSource.mockResolvedValue(selection);
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Open video" }));
    const timeline = await screen.findByLabelText("Video trim timeline");
    vi.spyOn(timeline, "getBoundingClientRect").mockReturnValue({
      x: 100,
      y: 0,
      left: 100,
      top: 0,
      right: 1100,
      bottom: 52,
      width: 1000,
      height: 52,
      toJSON: () => ({}),
    });

    fireEvent.pointerDown(screen.getByRole("slider", { name: "Trim start" }), {
      clientX: 350,
      pointerId: 1,
    });

    expect(screen.getByRole("slider", { name: "Trim start" })).toHaveAttribute(
      "aria-valuenow",
      "16250000",
    );
    expect(screen.getAllByText("00:00:16.250")).not.toHaveLength(0);

    fireEvent.pointerDown(screen.getByRole("slider", { name: "Trim end" }), {
      clientX: 100 + (16.75 / 65) * 1000,
      pointerId: 2,
    });
    expect(screen.getByRole("slider", { name: "Trim end" })).toHaveAttribute(
      "aria-valuenow",
      "17250000",
    );
    expect(screen.getByRole("slider", { name: "Trim end" })).toHaveAttribute(
      "aria-valuemin",
      "17250000",
    );
  });

  it("resets either trim boundary to its source edge on double-click", async () => {
    mocks.chooseSource.mockResolvedValue(selection);
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Open video" }));
    const video = (await screen.findByLabelText("Source video preview")) as HTMLVideoElement;
    const startHandle = screen.getByRole("slider", { name: "Trim start" });
    const endHandle = screen.getByRole("slider", { name: "Trim end" });
    const playhead = screen.getByRole("slider", { name: "Playback position" });

    video.currentTime = 10;
    fireEvent.timeUpdate(video);
    fireEvent.keyDown(window, { key: "i" });
    video.currentTime = 50;
    fireEvent.timeUpdate(video);
    fireEvent.keyDown(window, { key: "o" });
    video.currentTime = 30;
    fireEvent.timeUpdate(video);

    fireEvent.doubleClick(startHandle);
    expect(startHandle).toHaveAttribute("aria-valuenow", "0");
    expect(endHandle).toHaveAttribute("aria-valuenow", "50000000");
    expect(playhead).toHaveAttribute("aria-valuenow", "30000000");

    fireEvent.doubleClick(endHandle);
    expect(endHandle).toHaveAttribute("aria-valuenow", "65000000");
    expect(playhead).toHaveAttribute("aria-valuenow", "30000000");
    expect(startHandle).toHaveAttribute("title", "Trim start — double-click to reset");
    expect(endHandle).toHaveAttribute("title", "Trim end — double-click to reset");
  });

  it("drags the complete segment without resizing it or moving the playhead", async () => {
    mocks.chooseSource.mockResolvedValue(selection);
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Open video" }));
    const video = (await screen.findByLabelText("Source video preview")) as HTMLVideoElement;
    const timeline = screen.getByLabelText("Video trim timeline");
    vi.spyOn(timeline, "getBoundingClientRect").mockReturnValue({
      x: 100,
      y: 0,
      left: 100,
      top: 0,
      right: 1100,
      bottom: 52,
      width: 1000,
      height: 52,
      toJSON: () => ({}),
    });
    const clientXForSeconds = (seconds: number) => 100 + (seconds / 65) * 1000;

    video.currentTime = 10;
    fireEvent.timeUpdate(video);
    fireEvent.keyDown(window, { key: "i" });
    video.currentTime = 20;
    fireEvent.timeUpdate(video);
    fireEvent.keyDown(window, { key: "o" });
    video.currentTime = 30;
    fireEvent.timeUpdate(video);

    const safeTrimToggle = screen.getByRole("button", { name: "Safe trim following" });
    await user.click(safeTrimToggle);
    expect(safeTrimToggle).toHaveAttribute("aria-pressed", "false");

    const segmentHandle = screen.getByRole("slider", { name: "Move selected segment" });
    const playhead = screen.getByRole("slider", { name: "Playback position" });
    fireEvent.pointerDown(segmentHandle, {
      clientX: clientXForSeconds(15),
      pointerId: 30,
      shiftKey: true,
    });
    fireEvent.pointerMove(segmentHandle, {
      clientX: clientXForSeconds(40),
      pointerId: 30,
      shiftKey: true,
    });
    fireEvent.pointerUp(segmentHandle, {
      clientX: clientXForSeconds(40),
      pointerId: 30,
      shiftKey: true,
    });

    expect(screen.getByRole("slider", { name: "Trim start" })).toHaveAttribute(
      "aria-valuenow",
      "35000000",
    );
    expect(screen.getByRole("slider", { name: "Trim end" })).toHaveAttribute(
      "aria-valuenow",
      "45000000",
    );
    expect(segmentHandle).toHaveAttribute("aria-valuenow", "35000000");
    expect(playhead).toHaveAttribute("aria-valuenow", "30000000");
    expect(video.currentTime).toBe(30);

    fireEvent.pointerDown(segmentHandle, {
      clientX: clientXForSeconds(40),
      pointerId: 31,
    });
    fireEvent.pointerUp(segmentHandle, {
      clientX: clientXForSeconds(70),
      pointerId: 31,
    });
    expect(screen.getByRole("slider", { name: "Trim start" })).toHaveAttribute(
      "aria-valuenow",
      "55000000",
    );
    expect(screen.getByRole("slider", { name: "Trim end" })).toHaveAttribute(
      "aria-valuenow",
      "65000000",
    );

    fireEvent.pointerDown(segmentHandle, {
      clientX: clientXForSeconds(60),
      pointerId: 32,
    });
    fireEvent.pointerUp(segmentHandle, {
      clientX: clientXForSeconds(-5),
      pointerId: 32,
    });
    expect(screen.getByRole("slider", { name: "Trim start" })).toHaveAttribute(
      "aria-valuenow",
      "0",
    );
    expect(screen.getByRole("slider", { name: "Trim end" })).toHaveAttribute(
      "aria-valuenow",
      "10000000",
    );
    expect(playhead).toHaveAttribute("aria-valuenow", "30000000");
    expect(video.currentTime).toBe(30);
  });

  it("snaps all dragged segment points regardless of the safe-trim state", async () => {
    mocks.chooseSource.mockResolvedValue(selection);
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Open video" }));
    const video = (await screen.findByLabelText("Source video preview")) as HTMLVideoElement;
    const timeline = screen.getByLabelText("Video trim timeline");
    vi.spyOn(timeline, "getBoundingClientRect").mockReturnValue({
      x: 100,
      y: 0,
      left: 100,
      top: 0,
      right: 1100,
      bottom: 52,
      width: 1000,
      height: 52,
      toJSON: () => ({}),
    });
    const clientXForSeconds = (seconds: number) => 100 + (seconds / 65) * 1000;

    video.currentTime = 10;
    fireEvent.timeUpdate(video);
    fireEvent.keyDown(window, { key: "i" });
    video.currentTime = 20;
    fireEvent.timeUpdate(video);
    fireEvent.keyDown(window, { key: "o" });
    video.currentTime = 30;
    fireEvent.timeUpdate(video);

    const safeTrimToggle = screen.getByRole("button", { name: "Safe trim following" });
    await user.click(safeTrimToggle);
    const segmentHandle = screen.getByRole("slider", { name: "Move selected segment" });
    const playhead = screen.getByRole("slider", { name: "Playback position" });

    fireEvent.pointerDown(segmentHandle, {
      clientX: clientXForSeconds(15),
      pointerId: 33,
    });
    fireEvent.pointerMove(segmentHandle, {
      clientX: clientXForSeconds(24.5),
      pointerId: 33,
    });
    expect(segmentHandle).not.toHaveAttribute("data-snap-point");
    expect(screen.getByRole("slider", { name: "Trim start" })).toHaveAttribute(
      "aria-valuenow",
      "19500000",
    );

    fireEvent.pointerMove(segmentHandle, {
      clientX: clientXForSeconds(24.5),
      pointerId: 33,
      shiftKey: true,
    });
    expect(segmentHandle).toHaveAttribute("data-snap-point", "end");
    expect(screen.getByRole("slider", { name: "Trim start" })).toHaveAttribute(
      "aria-valuenow",
      "20000000",
    );

    fireEvent.pointerMove(segmentHandle, {
      clientX: clientXForSeconds(24.5),
      pointerId: 33,
    });
    expect(segmentHandle).not.toHaveAttribute("data-snap-point");
    expect(screen.getByRole("slider", { name: "Trim start" })).toHaveAttribute(
      "aria-valuenow",
      "19500000",
    );

    fireEvent.pointerMove(segmentHandle, {
      clientX: clientXForSeconds(24.5),
      pointerId: 33,
      shiftKey: true,
    });
    expect(segmentHandle).toHaveAttribute("data-snap-point", "end");

    fireEvent.pointerMove(segmentHandle, {
      clientX: clientXForSeconds(29.5),
      pointerId: 33,
      shiftKey: true,
    });
    expect(segmentHandle).toHaveAttribute("data-snap-point", "center");
    expect(screen.getByRole("slider", { name: "Trim start" })).toHaveAttribute(
      "aria-valuenow",
      "25000000",
    );

    fireEvent.pointerMove(segmentHandle, {
      clientX: clientXForSeconds(35.5),
      pointerId: 33,
      shiftKey: true,
    });
    expect(segmentHandle).toHaveAttribute("data-snap-point", "start");
    expect(screen.getByRole("slider", { name: "Trim start" })).toHaveAttribute(
      "aria-valuenow",
      "30000000",
    );
    fireEvent.pointerUp(segmentHandle, {
      clientX: clientXForSeconds(35.5),
      pointerId: 33,
      shiftKey: true,
    });
    expect(playhead).toHaveAttribute("aria-valuenow", "30000000");

    await user.click(safeTrimToggle);
    video.currentTime = 35;
    fireEvent.timeUpdate(video);
    fireEvent.pointerDown(segmentHandle, {
      clientX: clientXForSeconds(35),
      pointerId: 34,
    });
    fireEvent.pointerMove(segmentHandle, {
      clientX: clientXForSeconds(30.5),
      pointerId: 34,
      shiftKey: true,
    });
    expect(segmentHandle).toHaveAttribute("data-snap-point", "end");
    expect(screen.getByRole("slider", { name: "Trim end" })).toHaveAttribute(
      "aria-valuenow",
      "35000000",
    );
    fireEvent.pointerUp(segmentHandle, {
      clientX: clientXForSeconds(30.5),
      pointerId: 34,
      shiftKey: true,
    });

    fireEvent.pointerDown(segmentHandle, {
      clientX: clientXForSeconds(30),
      pointerId: 35,
    });
    fireEvent.pointerMove(segmentHandle, {
      clientX: clientXForSeconds(34.5),
      pointerId: 35,
      shiftKey: true,
    });
    expect(segmentHandle).toHaveAttribute("data-snap-point", "center");
    expect(screen.getByRole("slider", { name: "Trim start" })).toHaveAttribute(
      "aria-valuenow",
      "30000000",
    );
    fireEvent.pointerUp(segmentHandle, {
      clientX: clientXForSeconds(34.5),
      pointerId: 35,
      shiftKey: true,
    });

    video.currentTime = 45;
    fireEvent.timeUpdate(video);
    fireEvent.pointerDown(segmentHandle, {
      clientX: clientXForSeconds(35),
      pointerId: 36,
    });
    fireEvent.pointerMove(segmentHandle, {
      clientX: clientXForSeconds(39.5),
      pointerId: 36,
      shiftKey: true,
    });
    expect(segmentHandle).toHaveAttribute("data-snap-point", "end");
    expect(screen.getByRole("slider", { name: "Trim end" })).toHaveAttribute(
      "aria-valuenow",
      "45000000",
    );
    fireEvent.pointerUp(segmentHandle, {
      clientX: clientXForSeconds(39.5),
      pointerId: 36,
      shiftKey: true,
    });
    expect(playhead).toHaveAttribute("aria-valuenow", "45000000");
  });

  it("holds a safely followed segment border through the snap radius before releasing it", async () => {
    mocks.chooseSource.mockResolvedValue(selection);
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Open video" }));
    const video = (await screen.findByLabelText("Source video preview")) as HTMLVideoElement;
    const timeline = screen.getByLabelText("Video trim timeline");
    vi.spyOn(timeline, "getBoundingClientRect").mockReturnValue({
      x: 100,
      y: 0,
      left: 100,
      top: 0,
      right: 1100,
      bottom: 52,
      width: 1000,
      height: 52,
      toJSON: () => ({}),
    });
    const clientXForSeconds = (seconds: number) => 100 + (seconds / 65) * 1000;

    video.currentTime = 10;
    fireEvent.timeUpdate(video);
    fireEvent.keyDown(window, { key: "i" });
    video.currentTime = 20;
    fireEvent.timeUpdate(video);
    fireEvent.keyDown(window, { key: "o" });
    video.currentTime = 30;
    fireEvent.timeUpdate(video);

    const segmentHandle = screen.getByRole("slider", { name: "Move selected segment" });
    const trimStart = screen.getByRole("slider", { name: "Trim start" });
    const playhead = screen.getByRole("slider", { name: "Playback position" });

    fireEvent.pointerDown(segmentHandle, {
      clientX: clientXForSeconds(15),
      pointerId: 37,
      shiftKey: true,
    });
    fireEvent.pointerMove(segmentHandle, {
      clientX: clientXForSeconds(35),
      pointerId: 37,
      shiftKey: true,
    });
    expect(segmentHandle).toHaveAttribute("data-snap-point", "start");
    expect(playhead).toHaveAttribute("aria-valuenow", "30000000");

    fireEvent.pointerMove(segmentHandle, {
      clientX: clientXForSeconds(35.5),
      pointerId: 37,
      shiftKey: true,
    });
    expect(segmentHandle).toHaveAttribute("data-snap-point", "start");
    expect(trimStart).toHaveAttribute("aria-valuenow", "30000000");
    expect(playhead).toHaveAttribute("aria-valuenow", "30000000");

    fireEvent.pointerMove(segmentHandle, {
      clientX: clientXForSeconds(36),
      pointerId: 37,
      shiftKey: true,
    });
    expect(segmentHandle).not.toHaveAttribute("data-snap-point");
    expect(trimStart).toHaveAttribute("aria-valuenow", "31000000");
    expect(playhead).toHaveAttribute("aria-valuenow", "31000000");

    fireEvent.pointerMove(segmentHandle, {
      clientX: clientXForSeconds(36.5),
      pointerId: 37,
      shiftKey: true,
    });
    expect(segmentHandle).not.toHaveAttribute("data-snap-point");
    expect(trimStart).toHaveAttribute("aria-valuenow", "31500000");
    expect(playhead).toHaveAttribute("aria-valuenow", "31500000");

    fireEvent.pointerMove(segmentHandle, {
      clientX: clientXForSeconds(36.3),
      pointerId: 37,
      shiftKey: true,
    });
    expect(segmentHandle).toHaveAttribute("data-snap-point", "start");
    expect(trimStart).toHaveAttribute("aria-valuenow", "31500000");
    fireEvent.pointerUp(segmentHandle, {
      clientX: clientXForSeconds(36.3),
      pointerId: 37,
      shiftKey: true,
    });
  });

  it("catches and follows the playhead while safely dragging the segment", async () => {
    mocks.chooseSource.mockResolvedValue(selection);
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Open video" }));
    const video = (await screen.findByLabelText("Source video preview")) as HTMLVideoElement;
    const timeline = screen.getByLabelText("Video trim timeline");
    vi.spyOn(timeline, "getBoundingClientRect").mockReturnValue({
      x: 100,
      y: 0,
      left: 100,
      top: 0,
      right: 1100,
      bottom: 52,
      width: 1000,
      height: 52,
      toJSON: () => ({}),
    });
    const clientXForSeconds = (seconds: number) => 100 + (seconds / 65) * 1000;

    video.currentTime = 10;
    fireEvent.timeUpdate(video);
    fireEvent.keyDown(window, { key: "i" });
    video.currentTime = 20;
    fireEvent.timeUpdate(video);
    fireEvent.keyDown(window, { key: "o" });
    video.currentTime = 30;
    fireEvent.timeUpdate(video);

    const segmentHandle = screen.getByRole("slider", { name: "Move selected segment" });
    const playhead = screen.getByRole("slider", { name: "Playback position" });

    fireEvent.pointerDown(segmentHandle, {
      clientX: clientXForSeconds(15),
      pointerId: 40,
    });
    fireEvent.pointerMove(segmentHandle, {
      clientX: clientXForSeconds(25),
      pointerId: 40,
    });
    expect(playhead).toHaveAttribute("aria-valuenow", "30000000");

    fireEvent.pointerMove(segmentHandle, {
      clientX: clientXForSeconds(35),
      pointerId: 40,
    });
    expect(playhead).toHaveAttribute("aria-valuenow", "30000000");

    fireEvent.pointerMove(segmentHandle, {
      clientX: clientXForSeconds(40),
      pointerId: 40,
    });
    expect(playhead).toHaveAttribute("aria-valuenow", "35000000");
    expect(video.currentTime).toBe(35);
    fireEvent.pointerUp(segmentHandle, {
      clientX: clientXForSeconds(40),
      pointerId: 40,
    });

    video.currentTime = 30;
    fireEvent.timeUpdate(video);
    fireEvent.pointerDown(segmentHandle, {
      clientX: clientXForSeconds(40),
      pointerId: 41,
    });
    fireEvent.pointerMove(segmentHandle, {
      clientX: clientXForSeconds(35),
      pointerId: 41,
    });
    expect(playhead).toHaveAttribute("aria-valuenow", "30000000");

    fireEvent.pointerMove(segmentHandle, {
      clientX: clientXForSeconds(25),
      pointerId: 41,
    });
    expect(playhead).toHaveAttribute("aria-valuenow", "30000000");

    fireEvent.pointerMove(segmentHandle, {
      clientX: clientXForSeconds(20),
      pointerId: 41,
    });
    expect(playhead).toHaveAttribute("aria-valuenow", "25000000");
    expect(video.currentTime).toBe(25);

    fireEvent.pointerMove(segmentHandle, {
      clientX: clientXForSeconds(22),
      pointerId: 41,
    });
    expect(playhead).toHaveAttribute("aria-valuenow", "25000000");
    expect(video.currentTime).toBe(25);

    fireEvent.pointerMove(segmentHandle, {
      clientX: clientXForSeconds(30),
      pointerId: 41,
    });
    expect(playhead).toHaveAttribute("aria-valuenow", "25000000");

    fireEvent.pointerMove(segmentHandle, {
      clientX: clientXForSeconds(35),
      pointerId: 41,
    });
    expect(playhead).toHaveAttribute("aria-valuenow", "30000000");
    expect(video.currentTime).toBe(30);
    fireEvent.pointerUp(segmentHandle, {
      clientX: clientXForSeconds(35),
      pointerId: 41,
    });
  });

  it("moves the playhead only when a shrinking trim handle crosses it", async () => {
    mocks.chooseSource.mockResolvedValue(selection);
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Open video" }));
    const video = (await screen.findByLabelText("Source video preview")) as HTMLVideoElement;
    const timeline = screen.getByLabelText("Video trim timeline");
    vi.spyOn(timeline, "getBoundingClientRect").mockReturnValue({
      x: 100,
      y: 0,
      left: 100,
      top: 0,
      right: 1100,
      bottom: 52,
      width: 1000,
      height: 52,
      toJSON: () => ({}),
    });

    video.currentTime = 30;
    fireEvent.timeUpdate(video);
    const playhead = screen.getByRole("slider", { name: "Playback position" });
    const clientXForSeconds = (seconds: number) => 100 + (seconds / 65) * 1000;
    const dragBoundaryTo = (name: "Trim start" | "Trim end", seconds: number) => {
      fireEvent.pointerDown(screen.getByRole("slider", { name }), {
        clientX: clientXForSeconds(seconds),
        pointerId: 1,
      });
    };

    dragBoundaryTo("Trim start", 10);
    expect(playhead).toHaveAttribute("aria-valuenow", "30000000");
    expect(video.currentTime).toBe(30);

    dragBoundaryTo("Trim start", 40);
    expect(playhead).toHaveAttribute("aria-valuenow", "40000000");
    expect(video.currentTime).toBe(40);

    dragBoundaryTo("Trim start", 20);
    expect(playhead).toHaveAttribute("aria-valuenow", "40000000");
    expect(video.currentTime).toBe(40);

    dragBoundaryTo("Trim end", 50);
    expect(playhead).toHaveAttribute("aria-valuenow", "40000000");
    expect(video.currentTime).toBe(40);

    dragBoundaryTo("Trim end", 30);
    expect(playhead).toHaveAttribute("aria-valuenow", "30000000");
    expect(video.currentTime).toBe(30);

    dragBoundaryTo("Trim end", 50);
    expect(playhead).toHaveAttribute("aria-valuenow", "30000000");
    expect(video.currentTime).toBe(30);
  });

  it("lets the safe-trim toggle disable and restore playhead following", async () => {
    mocks.chooseSource.mockResolvedValue(selection);
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Open video" }));
    const video = (await screen.findByLabelText("Source video preview")) as HTMLVideoElement;
    const timeline = screen.getByLabelText("Video trim timeline");
    vi.spyOn(timeline, "getBoundingClientRect").mockReturnValue({
      x: 100,
      y: 0,
      left: 100,
      top: 0,
      right: 1100,
      bottom: 52,
      width: 1000,
      height: 52,
      toJSON: () => ({}),
    });
    const clientXForSeconds = (seconds: number) => 100 + (seconds / 65) * 1000;
    const safeTrimToggle = screen.getByRole("button", { name: "Safe trim following" });
    const playhead = screen.getByRole("slider", { name: "Playback position" });

    video.currentTime = 30;
    fireEvent.timeUpdate(video);
    expect(safeTrimToggle).toHaveAttribute("aria-pressed", "true");

    await user.click(safeTrimToggle);
    expect(safeTrimToggle).toHaveAttribute("aria-pressed", "false");
    fireEvent.pointerDown(screen.getByRole("slider", { name: "Trim start" }), {
      clientX: clientXForSeconds(40),
      pointerId: 20,
    });
    expect(playhead).toHaveAttribute("aria-valuenow", "30000000");

    fireEvent.pointerDown(screen.getByRole("slider", { name: "Trim start" }), {
      clientX: clientXForSeconds(20),
      pointerId: 21,
    });
    await user.click(safeTrimToggle);
    fireEvent.pointerDown(screen.getByRole("slider", { name: "Trim start" }), {
      clientX: clientXForSeconds(35),
      pointerId: 22,
    });
    expect(safeTrimToggle).toHaveAttribute("aria-pressed", "true");
    expect(playhead).toHaveAttribute("aria-valuenow", "35000000");
    expect(video.currentTime).toBe(35);
  });

  it("holds a safely followed trim border through the snap radius before releasing it", async () => {
    mocks.chooseSource.mockResolvedValue(selection);
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Open video" }));
    const video = (await screen.findByLabelText("Source video preview")) as HTMLVideoElement;
    const timeline = screen.getByLabelText("Video trim timeline");
    vi.spyOn(timeline, "getBoundingClientRect").mockReturnValue({
      x: 100,
      y: 0,
      left: 100,
      top: 0,
      right: 1100,
      bottom: 52,
      width: 1000,
      height: 52,
      toJSON: () => ({}),
    });
    const clientXForSeconds = (seconds: number) => 100 + (seconds / 65) * 1000;

    video.currentTime = 30;
    fireEvent.timeUpdate(video);
    const trimStart = screen.getByRole("slider", { name: "Trim start" });
    const playhead = screen.getByRole("slider", { name: "Playback position" });

    fireEvent.pointerDown(trimStart, {
      clientX: clientXForSeconds(30),
      pointerId: 23,
      shiftKey: true,
    });
    expect(trimStart).toHaveAttribute("data-snap-active", "true");
    expect(playhead).toHaveAttribute("aria-valuenow", "30000000");

    fireEvent.pointerMove(trimStart, {
      clientX: clientXForSeconds(30.5),
      pointerId: 23,
      shiftKey: true,
    });
    expect(trimStart).toHaveAttribute("data-snap-active", "true");
    expect(trimStart).toHaveAttribute("aria-valuenow", "30000000");
    expect(playhead).toHaveAttribute("aria-valuenow", "30000000");

    fireEvent.pointerMove(trimStart, {
      clientX: clientXForSeconds(31),
      pointerId: 23,
      shiftKey: true,
    });
    expect(trimStart).not.toHaveAttribute("data-snap-active");
    expect(trimStart).toHaveAttribute("aria-valuenow", "31000000");
    expect(playhead).toHaveAttribute("aria-valuenow", "31000000");

    fireEvent.pointerMove(trimStart, {
      clientX: clientXForSeconds(31.5),
      pointerId: 23,
      shiftKey: true,
    });
    expect(trimStart).not.toHaveAttribute("data-snap-active");
    expect(trimStart).toHaveAttribute("aria-valuenow", "31500000");
    expect(playhead).toHaveAttribute("aria-valuenow", "31500000");

    fireEvent.pointerMove(trimStart, {
      clientX: clientXForSeconds(31.3),
      pointerId: 23,
      shiftKey: true,
    });
    expect(trimStart).toHaveAttribute("data-snap-active", "true");
    expect(trimStart).toHaveAttribute("aria-valuenow", "31500000");
    fireEvent.pointerUp(trimStart, {
      pointerId: 23,
      shiftKey: true,
    });
  });

  it("uses Shift to snap playhead and trim-handle drags to each other", async () => {
    mocks.chooseSource.mockResolvedValue(selection);
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Open video" }));
    const video = (await screen.findByLabelText("Source video preview")) as HTMLVideoElement;
    vi.spyOn(video, "pause").mockImplementation(() => undefined);
    const timeline = screen.getByLabelText("Video trim timeline");
    vi.spyOn(timeline, "getBoundingClientRect").mockReturnValue({
      x: 100,
      y: 0,
      left: 100,
      top: 0,
      right: 1100,
      bottom: 52,
      width: 1000,
      height: 52,
      toJSON: () => ({}),
    });
    const clientXForSeconds = (seconds: number) => 100 + (seconds / 65) * 1000;

    video.currentTime = 10;
    fireEvent.timeUpdate(video);
    fireEvent.keyDown(window, { key: "i" });
    video.currentTime = 50;
    fireEvent.timeUpdate(video);
    fireEvent.keyDown(window, { key: "o" });

    video.currentTime = 5;
    fireEvent.timeUpdate(video);
    fireEvent.pointerDown(screen.getByRole("slider", { name: "Trim start" }), {
      clientX: clientXForSeconds(10),
      pointerId: 9,
      shiftKey: true,
    });
    expect(screen.getByRole("slider", { name: "Trim start" })).toHaveAttribute(
      "aria-valuenow",
      "10000000",
    );
    expect(screen.getByRole("slider", { name: "Trim start" })).toHaveAttribute(
      "data-dragging",
      "true",
    );
    expect(screen.getByRole("slider", { name: "Trim start" })).not.toHaveAttribute(
      "data-snap-active",
    );
    expect(screen.getByRole("slider", { name: "Playback position" })).toHaveAttribute(
      "aria-valuenow",
      "5000000",
    );
    fireEvent.pointerUp(screen.getByRole("slider", { name: "Trim start" }), {
      pointerId: 9,
    });
    expect(screen.getByRole("slider", { name: "Trim start" })).not.toHaveAttribute("data-dragging");

    video.currentTime = 30;
    fireEvent.timeUpdate(video);

    const playhead = screen.getByRole("slider", { name: "Playback position" });
    fireEvent.pointerDown(playhead, {
      clientX: clientXForSeconds(30),
      pointerId: 10,
      shiftKey: true,
    });
    fireEvent.pointerUp(playhead, {
      clientX: clientXForSeconds(5),
      pointerId: 10,
      shiftKey: true,
    });
    expect(playhead).toHaveAttribute("aria-valuenow", "10000000");
    expect(video.currentTime).toBe(10);

    fireEvent.pointerDown(playhead, {
      clientX: clientXForSeconds(10),
      pointerId: 11,
      shiftKey: true,
    });
    fireEvent.pointerUp(playhead, {
      clientX: clientXForSeconds(60),
      pointerId: 11,
      shiftKey: true,
    });
    expect(playhead).toHaveAttribute("aria-valuenow", "50000000");
    expect(video.currentTime).toBe(50);

    video.currentTime = 30;
    fireEvent.timeUpdate(video);
    fireEvent.pointerDown(screen.getByRole("slider", { name: "Trim start" }), {
      clientX: clientXForSeconds(30.5),
      pointerId: 12,
      shiftKey: true,
    });
    expect(screen.getByRole("slider", { name: "Trim start" })).toHaveAttribute(
      "aria-valuenow",
      "30000000",
    );
    expect(screen.getByRole("slider", { name: "Trim start" })).toHaveAttribute(
      "data-snap-active",
      "true",
    );
    expect(playhead).toHaveAttribute("aria-valuenow", "30000000");
    fireEvent.pointerUp(screen.getByRole("slider", { name: "Trim start" }), {
      pointerId: 12,
    });

    fireEvent.pointerDown(screen.getByRole("slider", { name: "Trim start" }), {
      clientX: clientXForSeconds(20),
      pointerId: 13,
      shiftKey: true,
    });
    fireEvent.pointerDown(screen.getByRole("slider", { name: "Trim end" }), {
      clientX: clientXForSeconds(29.5),
      pointerId: 14,
      shiftKey: true,
    });
    expect(screen.getByRole("slider", { name: "Trim end" })).toHaveAttribute(
      "aria-valuenow",
      "30000000",
    );
    expect(screen.getByRole("slider", { name: "Trim end" })).toHaveAttribute(
      "data-snap-active",
      "true",
    );
    expect(playhead).toHaveAttribute("aria-valuenow", "30000000");
  });

  it("scrubs the playhead continuously and seeks the preview before release", async () => {
    mocks.chooseSource.mockResolvedValue(selection);
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Open video" }));
    const video = (await screen.findByLabelText("Source video preview")) as HTMLVideoElement;
    const play = vi.spyOn(video, "play").mockResolvedValue();
    vi.spyOn(video, "pause").mockImplementation(() => undefined);
    const timeline = screen.getByLabelText("Video trim timeline");
    vi.spyOn(timeline, "getBoundingClientRect").mockReturnValue({
      x: 100,
      y: 0,
      left: 100,
      top: 0,
      right: 1100,
      bottom: 52,
      width: 1000,
      height: 52,
      toJSON: () => ({}),
    });
    const playhead = screen.getByRole("slider", { name: "Playback position" });
    fireEvent.play(video);

    fireEvent.pointerDown(playhead, { clientX: 100, pointerId: 7 });
    fireEvent.pointerMove(playhead, { clientX: 600, pointerId: 7 });

    await waitFor(() => expect(video.currentTime).toBe(32.5));
    expect(playhead).toHaveAttribute("aria-valuenow", "32500000");
    expect(screen.getByLabelText("Current playback time")).toHaveTextContent("00:00:32.500");

    fireEvent.pointerUp(playhead, { clientX: 600, pointerId: 7 });
    expect(play).toHaveBeenCalledOnce();
  });

  it("synchronizes the timeline playhead with video playback", async () => {
    mocks.chooseSource.mockResolvedValue(selection);
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Open video" }));
    const video = (await screen.findByLabelText("Source video preview")) as HTMLVideoElement;
    video.currentTime = 12.5;
    fireEvent.timeUpdate(video);

    expect(screen.getByRole("slider", { name: "Playback position" })).toHaveStyle({
      left: "19.230769230769234%",
    });
    expect(screen.getByRole("slider", { name: "Playback position" })).toHaveAttribute(
      "aria-valuenow",
      "12500000",
    );
  });

  it("reports a compatible preview playback failure without dropping metadata", async () => {
    mocks.chooseSource.mockResolvedValue(selection);
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Open video" }));
    fireEvent.error(await screen.findByLabelText("Source video preview"));
    const proxyPreview = await screen.findByText("720p preview");
    expect(proxyPreview).toBeInTheDocument();
    fireEvent.error(screen.getByLabelText("Source video preview"));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The compatible preview could not be played.",
    );
    expect(screen.getByRole("heading", { name: "holiday.mp4" })).toBeInTheDocument();
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
      sourceDropListener?.({
        status: "failed",
        error: { code: "unsupported_media", message: "This file type is not supported yet." },
      });
    });

    expect(screen.queryByRole("heading", { name: "holiday.mp4" })).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("This file type is not supported yet.");
  });

  it("inspects a source selected by the native drop listener", async () => {
    render(<App />);

    act(() => {
      sourceDropListener?.({ status: "selected", source: selection });
    });

    expect(await screen.findByRole("heading", { name: "holiday.mp4" })).toBeInTheDocument();
    expect(mocks.inspectMedia).toHaveBeenCalledWith(selection.sourceId);
    expect(await screen.findByText("3840 × 2160")).toBeInTheDocument();
  });

  it("shows the native drag overlay over the editor stage", async () => {
    mocks.chooseSource.mockResolvedValue(selection);
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Open video" }));
    expect(await screen.findByRole("heading", { name: "holiday.mp4" })).toBeInTheDocument();

    act(() => sourceDropListener?.({ status: "drag", active: true }));
    expect(screen.getByRole("status", { name: "Drop video to open" })).toBeInTheDocument();

    act(() => sourceDropListener?.({ status: "drag", active: false }));
    expect(screen.queryByRole("status", { name: "Drop video to open" })).not.toBeInTheDocument();
  });

  it("cleans up the native source-drop listener on unmount", async () => {
    const view = render(<App />);
    await waitFor(() => expect(sourceDropListener).toBeDefined());

    view.unmount();

    expect(mocks.unlistenDrops).toHaveBeenCalledOnce();
  });
});

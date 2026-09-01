import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_PREFERENCES } from "../app/preferences";
import { importQueueItemActivated } from "../app/store/actions/imported-queue-actions";
import { sourceCleared, sourceReady } from "../app/store/actions/source-actions";
import { startSourceMediaRuntime } from "../app/store/integration/source-media-runtime";
import {
  createEditorToolsStateFromPreferences,
  editorToolsInitialized,
} from "../app/store/slices/editor-tools-slice";
import {
  importQueueItemAdded,
  importQueueItemRemoved,
  selectImportQueueItems,
} from "../app/store/slices/export-slice";
import { previewReady } from "../app/store/slices/preview-slice";
import { selectHasSource } from "../app/store/slices/source-slice";
import { store } from "../app/store/store";
import { checkMediaCapabilitiesRequested } from "../app/store/thunks/source-media-thunks";
import type { EditorSnapshot } from "../domain/editor-snapshot";
import type { SourceRef } from "../domain/source";
import type { MediaCapabilities, MediaInfo, SourceDropEvent } from "../lib/tauri/media.types";

const mocks = vi.hoisted(() => ({
  checkMediaCapabilities: vi.fn(),
  chooseSource: vi.fn(),
  activateSourcePath: vi.fn(),
  inspectMedia: vi.fn(),
  listenForSourceDrops: vi.fn(),
  prepareAudioPreviews: vi.fn(),
  prepareProxyPreview: vi.fn(),
  prepareSourcePreview: vi.fn(),
  prepareWaveforms: vi.fn(),
  unlistenDrops: vi.fn(),
}));

vi.mock("../lib/tauri/media", async (importOriginal) => {
  const original = await importOriginal<typeof import("../lib/tauri/media")>();
  return {
    ...original,
    checkMediaCapabilities: mocks.checkMediaCapabilities,
    chooseSource: mocks.chooseSource,
    activateSourcePath: mocks.activateSourcePath,
    inspectMedia: mocks.inspectMedia,
    listenForSourceDrops: mocks.listenForSourceDrops,
    prepareAudioPreviews: mocks.prepareAudioPreviews,
    prepareProxyPreview: mocks.prepareProxyPreview,
    prepareSourcePreview: mocks.prepareSourcePreview,
    prepareWaveforms: mocks.prepareWaveforms,
  };
});

import { App } from "../App";

const capabilities: MediaCapabilities = {
  ffmpeg: { available: true, version: "ffmpeg version 7.1" },
  ffprobe: { available: true, version: "ffprobe version 7.1" },
};

const selection: SourceRef = {
  displayName: "holiday.mp4",
  sourcePath: "C:/Media/holiday.mp4",
};

const replacementSelection: SourceRef = {
  displayName: "replacement.mp4",
  sourcePath: "C:/Media/replacement.mp4",
};

const media: MediaInfo = {
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
let stopSourceMediaRuntime: (() => void) | undefined;

async function openSourcePicker(user: ReturnType<typeof userEvent.setup>) {
  getMenuTrigger("File").focus();
  await user.keyboard("{Enter}");
  await user.click(screen.getByRole("menuitem", { name: /Open File/ }));
  (document.activeElement as HTMLElement | null)?.blur();
}

function getMenuTrigger(name: string) {
  return within(screen.getByRole("menubar", { name: "Application menus" })).getByRole("menuitem", {
    name,
  });
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });

  return { promise, resolve };
}

async function waitForSourcePresence(expected: boolean) {
  await waitFor(() => expect(selectHasSource(store.getState())).toBe(expected));
}

function installAudioMocks(initiallyReady = true) {
  const audioElements: HTMLAudioElement[] = [];
  const mediaElementSources: Array<{
    connect: ReturnType<typeof vi.fn>;
    connectedGain: { gain: { value: number } } | null;
    disconnect: ReturnType<typeof vi.fn>;
    element: HTMLMediaElement;
  }> = [];

  const audioConstructor = vi.fn(function AudioMock() {
    const element = document.createElement("audio");
    Object.defineProperty(element, "readyState", {
      configurable: true,
      get: () =>
        initiallyReady ? HTMLMediaElement.HAVE_FUTURE_DATA : HTMLMediaElement.HAVE_METADATA,
    });
    Object.defineProperty(element, "pause", { configurable: true, value: vi.fn() });

    audioElements.push(element);
    return element;
  });

  const audioContext = {
    destination: {},
    resume: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    createGain: vi.fn(() => ({
      gain: { value: 1 },
      connect: vi.fn(),
      disconnect: vi.fn(),
    })),
    createMediaElementSource: vi.fn((element: HTMLMediaElement) => {
      const source: (typeof mediaElementSources)[number] = {
        connect: vi.fn(),
        connectedGain: null,
        disconnect: vi.fn(),
        element,
      };

      source.connect.mockImplementation((destination: unknown) => {
        source.connectedGain = destination as { gain: { value: number } };
        return destination;
      });

      mediaElementSources.push(source);
      return source;
    }),
  };

  vi.stubGlobal("Audio", audioConstructor);
  vi.stubGlobal(
    "AudioContext",
    vi.fn(function AudioContextMock() {
      return audioContext;
    }),
  );

  return { audioConstructor, audioContext, audioElements, mediaElementSources };
}

beforeEach(() => {
  vi.clearAllMocks();
  store.dispatch(sourceCleared());
  for (const item of selectImportQueueItems(store.getState())) {
    store.dispatch(importQueueItemRemoved(item.id));
  }
  store.dispatch(
    editorToolsInitialized(createEditorToolsStateFromPreferences(DEFAULT_PREFERENCES)),
  );
  sourceDropListener = undefined;
  mocks.checkMediaCapabilities.mockResolvedValue(capabilities);
  mocks.chooseSource.mockResolvedValue([]);
  mocks.activateSourcePath.mockImplementation(async (sourcePath: string) =>
    sourcePath === replacementSelection.sourcePath ? replacementSelection : selection,
  );
  mocks.inspectMedia.mockResolvedValue(media);
  mocks.prepareAudioPreviews.mockResolvedValue([
    {
      mediaToken: 1,
      streamIndex: 1,
      url: "http://easytrim-media.localhost/source-1?variant=audio&stream=1",
    },
  ]);
  mocks.prepareSourcePreview.mockResolvedValue({
    mediaToken: 1,
    url: "http://easytrim-media.localhost/source-1?variant=source",
    kind: "source",
  });
  mocks.prepareProxyPreview.mockResolvedValue({
    mediaToken: 1,
    url: "http://easytrim-media.localhost/source-1?variant=proxy",
    kind: "proxy",
  });
  mocks.prepareWaveforms.mockImplementation(
    async (_sourcePath: string, jobId: string, streamIndexes: number[], width: number) =>
      streamIndexes.map((streamIndex) => ({
        status: "ready" as const,
        jobId,
        streamIndex,
        width,
        url: `http://easytrim-media.localhost/source?variant=waveform&stream=${streamIndex}&width=${width}`,
      })),
  );
  mocks.listenForSourceDrops.mockImplementation(
    async (listener: (event: SourceDropEvent) => void) => {
      sourceDropListener = listener;
      return mocks.unlistenDrops;
    },
  );
  stopSourceMediaRuntime = startSourceMediaRuntime(store.dispatch);
});

afterEach(() => {
  stopSourceMediaRuntime?.();
  stopSourceMediaRuntime = undefined;
});

describe("App", () => {
  it("preserves editor tools across source replacement", async () => {
    mocks.chooseSource
      .mockResolvedValueOnce([selection])
      .mockResolvedValueOnce([replacementSelection]);
    mocks.inspectMedia.mockImplementation(async () => media);
    mocks.prepareSourcePreview.mockImplementation(async () => ({
      mediaToken: 1,
      url: "http://easytrim-media.localhost/1?variant=source",
      kind: "source" as const,
    }));
    const user = userEvent.setup();
    render(<App />);
    const sourceMetadata = screen.getByLabelText("Video metadata");

    fireEvent.keyDown(window, { key: "o", code: "KeyO", ctrlKey: true });
    await within(sourceMetadata).findByText(selection.displayName);
    await user.click(screen.getByRole("button", { name: "Snap playback" }));
    await user.click(screen.getByRole("button", { name: "Loop playback" }));

    expect(screen.getByRole("button", { name: "Snap playback" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByRole("button", { name: "Loop playback" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );

    fireEvent.keyDown(window, { key: "o", code: "KeyO", ctrlKey: true });
    await within(sourceMetadata).findByText(replacementSelection.displayName);

    expect(screen.getByRole("button", { name: "Snap playback" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByRole("button", { name: "Loop playback" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("starts with the editor in a no-source state", async () => {
    render(<App />);

    expect(screen.queryByText("Start a new clip")).not.toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "Source" })).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Keyboard shortcuts" })).toHaveTextContent("Open File");
    expect(screen.getByRole("list", { name: "Keyboard shortcuts" })).toHaveTextContent(
      "Save Lossless Cut",
    );
    expect(screen.getByRole("list", { name: "Keyboard shortcuts" })).toHaveTextContent(
      "Optimize & Export",
    );
    expect(screen.getByRole("list", { name: "Keyboard shortcuts" })).toHaveTextContent(
      "Play / Pause",
    );
    expect(screen.getByRole("list", { name: "Keyboard shortcuts" })).toHaveTextContent(
      "Previous / Next Frame",
    );
    expect(screen.getByRole("list", { name: "Keyboard shortcuts" })).toHaveTextContent(
      "Mark In / Mark Out",
    );
    expect(screen.getAllByRole("link", { name: "Support on Ko-fi.com" })).not.toHaveLength(0);
    expect(
      screen
        .getAllByRole("link", { name: "Support on Ko-fi.com" })[0]!
        .querySelector('[data-brand-icon="kofi"]'),
    ).not.toBeNull();
    expect(screen.getByLabelText("Current playback time")).toHaveTextContent(
      "00:00:00:00f / 00:00:00:00f",
    );
    expect(screen.getByRole("button", { name: "Play" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Previous frame" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next frame" })).toBeDisabled();
    expect(screen.getByRole("slider", { name: "Move selected segment" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Snap playback" })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "Loop playback" })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "Segment playback" })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "Playback speed" })).not.toBeDisabled();
    expect(screen.getAllByText("00:00:00:00f").length).toBeGreaterThanOrEqual(8);
    expect(screen.queryByRole("slider", { name: "Playback position" })).toBeDisabled();
    expect(screen.queryByLabelText("Source video preview")).not.toBeInTheDocument();
    expect(screen.queryByTestId("audio-tracks-scroll")).not.toBeInTheDocument();
  });

  it("keeps the preview covered and playback controls disabled until it can play", async () => {
    const readyState = vi
      .spyOn(HTMLMediaElement.prototype, "readyState", "get")
      .mockReturnValue(HTMLMediaElement.HAVE_METADATA);

    mocks.chooseSource.mockResolvedValue([selection]);
    const user = userEvent.setup();

    try {
      render(<App />);
      await openSourcePicker(user);
      const video = (await screen.findByLabelText("Source video preview")) as HTMLVideoElement;
      const play = vi.spyOn(video, "play").mockResolvedValue();
      const trimStart = screen.getByRole("slider", { name: "Trim start" });
      const trimEnd = screen.getByRole("slider", { name: "Trim end" });

      expect(screen.getByTestId("preview-loading-overlay")).toBeInTheDocument();
      expect(screen.getByTestId("timeline-fixed-content")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Play" })).toBeDisabled();
      video.currentTime = 10;
      fireEvent.timeUpdate(video);
      fireEvent.keyDown(window, { key: " ", code: "Space" });
      fireEvent.keyDown(window, { key: "ArrowRight", code: "ArrowRight" });
      fireEvent.keyDown(window, { key: "i", code: "KeyI" });
      fireEvent.keyDown(window, { key: "o", code: "KeyO" });
      expect(play).not.toHaveBeenCalled();
      expect(video.currentTime).toBe(10);
      expect(trimStart).toHaveAttribute("aria-valuenow", "0");
      expect(trimEnd).toHaveAttribute("aria-valuenow", "65000000");

      readyState.mockReturnValue(HTMLMediaElement.HAVE_FUTURE_DATA);
      fireEvent.canPlay(video);

      await waitFor(() =>
        expect(screen.queryByTestId("preview-loading-overlay")).not.toBeInTheDocument(),
      );
      expect(screen.getByRole("button", { name: "Play" })).not.toBeDisabled();
      fireEvent.keyDown(window, { key: " ", code: "Space" });
      expect(play).toHaveBeenCalledOnce();
    } finally {
      readyState.mockRestore();
    }
  });

  it("switches snapshots atomically while keeping every workspace panel mounted", async () => {
    const firstSnapshot: EditorSnapshot = {
      source: selection,
      trim: { startMicros: 0, endMicros: media.durationMicros },
      crop: null,
      audio: { master: { enabled: true, volumePercent: 50 }, tracks: [], mergeAudio: false },
    };

    const replacementMedia: MediaInfo = {
      ...media,
      durationMicros: 30_000_000,
      video: { ...media.video, width: 1280, height: 720 },
    };

    const replacementSnapshot: EditorSnapshot = {
      source: replacementSelection,
      trim: { startMicros: 1_000_000, endMicros: 20_000_000 },
      crop: null,
      audio: { master: { enabled: true, volumePercent: 40 }, tracks: [], mergeAudio: false },
    };

    const firstItem = {
      id: "transition-a",
      status: "imported" as const,
      origin: "source-import" as const,
      media,
      snapshot: firstSnapshot,
    };

    const replacementItem = {
      id: "transition-b",
      status: "imported" as const,
      origin: "source-import" as const,
      media: replacementMedia,
      snapshot: replacementSnapshot,
    };

    store.dispatch(importQueueItemAdded(firstItem));
    store.dispatch(importQueueItemAdded(replacementItem));
    store.dispatch(
      importQueueItemActivated({
        id: firstItem.id,
        loadToken: 100,
        media,
        snapshot: firstSnapshot,
      }),
    );
    store.dispatch(sourceReady({ loadToken: 100, media, snapshot: firstSnapshot }));
    store.dispatch(
      previewReady({
        preview: {
          mediaToken: 1,
          url: "http://easytrim-media.localhost/transition-a?variant=source",
          kind: "source",
        },
      }),
    );
    const replacementInspection = createDeferred<MediaInfo>();
    mocks.inspectMedia.mockImplementation((sourcePath: string) =>
      sourcePath === replacementSelection.sourcePath
        ? replacementInspection.promise
        : Promise.resolve(media),
    );
    const user = userEvent.setup();
    render(<App />);

    await waitFor(() => expect(screen.getByRole("button", { name: "Play" })).not.toBeDisabled());
    const detailsPanel = document.getElementById("workspace-sidebar-source-details");
    const previewPanel = document.getElementById("editor-stage-preview");
    const timelinePanel = document.getElementById("editor-stage-timeline");
    const audioPanel = document.getElementById("editor-stage-audio");

    await user.click(screen.getByLabelText(`Restore ${replacementSelection.displayName}`));

    expect(document.getElementById("workspace-sidebar-source-details")).toBe(detailsPanel);
    expect(document.getElementById("editor-stage-preview")).toBe(previewPanel);
    expect(document.getElementById("editor-stage-timeline")).toBe(timelinePanel);
    expect(document.getElementById("editor-stage-audio")).toBe(audioPanel);
    expect(within(detailsPanel!).getByText(replacementSelection.displayName)).toBeInTheDocument();
    expect(within(detailsPanel!).getByText("1280 × 720")).toBeInTheDocument();
    const previewContent = previewPanel!.querySelector('[data-slot="preview-content"]');
    const previewLoadingOverlay = screen.getByTestId("preview-loading-overlay");
    expect(previewContent).toContainElement(previewLoadingOverlay);
    expect(previewLoadingOverlay).not.toHaveClass("fixed");
    expect(within(previewPanel!).getByText("Opening preview…")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Selected Segment" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Audio tracks/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Play" })).toBeDisabled();

    await act(async () => replacementInspection.resolve(replacementMedia));

    await waitFor(() => {
      expect(screen.queryByTestId("preview-loading-overlay")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Play" })).not.toBeDisabled();
    });
  });

  it("starts waveforms only after multi-track playback is ready without waiting for them", async () => {
    let resolveAudioPreviews!: (
      previews: Array<{ mediaToken: number; streamIndex: number; url: string }>,
    ) => void;

    mocks.chooseSource.mockResolvedValue([selection]);
    mocks.inspectMedia.mockResolvedValue({
      ...media,
      audioStreams: [
        ...media.audioStreams,
        {
          streamIndex: 2,
          codecName: "ac3",
          channels: 6,
          channelLayout: "5.1",
          sampleRateHz: 48_000,
          title: "Commentary",
          isDefault: false,
        },
      ],
    });
    mocks.prepareAudioPreviews.mockReturnValue(
      new Promise((resolve) => {
        resolveAudioPreviews = resolve;
      }),
    );
    mocks.prepareWaveforms.mockReturnValue(new Promise(() => undefined));
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    const { audioContext, audioElements } = installAudioMocks(false);
    const user = userEvent.setup();

    try {
      render(<App />);
      await openSourcePicker(user);
      await screen.findByLabelText("Source video preview");

      expect(screen.getByTestId("preview-loading-overlay")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Play" })).toBeDisabled();
      expect(mocks.prepareWaveforms).not.toHaveBeenCalled();

      await act(async () => {
        resolveAudioPreviews([
          {
            mediaToken: 1,
            streamIndex: 1,
            url: "http://easytrim-media.localhost/source-1?variant=audio&stream=1",
          },
          {
            mediaToken: 1,
            streamIndex: 2,
            url: "http://easytrim-media.localhost/source-1?variant=audio&stream=2",
          },
        ]);
      });

      await waitFor(() => expect(audioElements).toHaveLength(2));
      expect(screen.getByTestId("preview-loading-overlay")).toBeInTheDocument();
      expect(screen.getByTestId("timeline-fixed-content")).toBeInTheDocument();
      expect(mocks.prepareWaveforms).not.toHaveBeenCalled();
      for (const audio of audioElements) fireEvent.canPlay(audio);

      await waitFor(() =>
        expect(screen.queryByTestId("preview-loading-overlay")).not.toBeInTheDocument(),
      );
      expect(screen.getByRole("button", { name: "Play" })).not.toBeDisabled();
      await waitFor(() =>
        expect(mocks.prepareWaveforms).toHaveBeenCalledWith(
          selection.sourcePath,
          expect.stringMatching(/^waveform-/),
          [1, 2],
          4_096,
        ),
      );
      expect(screen.getAllByText("Preparing waveform…")).toHaveLength(2);

      await user.click(screen.getByRole("button", { name: "Play" }));

      expect(audioContext.resume).toHaveBeenCalledOnce();
      expect(play).toHaveBeenCalledTimes(3);
      expect(screen.getByRole("button", { name: "Play" })).not.toBeDisabled();
    } finally {
      play.mockRestore();
      vi.unstubAllGlobals();
    }
  });

  it("uses the video element audio clock for a single-track source", async () => {
    mocks.chooseSource.mockResolvedValue([selection]);
    const user = userEvent.setup();
    render(<App />);

    await openSourcePicker(user);
    const video = await screen.findByLabelText("Source video preview");

    expect(mocks.prepareAudioPreviews).not.toHaveBeenCalled();
    expect(video).toHaveProperty("muted", false);
    expect(video).toHaveAttribute("crossorigin", "anonymous");
  });

  it("switches between native and custom audio without interrupting video playback", async () => {
    mocks.chooseSource.mockResolvedValue([selection]);
    mocks.inspectMedia.mockResolvedValue({
      ...media,
      audioStreams: [
        ...media.audioStreams,
        {
          streamIndex: 2,
          codecName: "ac3",
          channels: 6,
          channelLayout: "5.1",
          sampleRateHz: 48_000,
          title: "Commentary",
          isDefault: false,
        },
      ],
    });
    mocks.prepareAudioPreviews.mockResolvedValue([
      {
        mediaToken: 1,
        streamIndex: 1,
        url: "http://easytrim-media.localhost/source-1?variant=audio&stream=1",
      },
      {
        mediaToken: 1,
        streamIndex: 2,
        url: "http://easytrim-media.localhost/source-1?variant=audio&stream=2",
      },
    ]);
    const { audioElements, mediaElementSources } = installAudioMocks(false);

    const user = userEvent.setup();

    try {
      render(<App />);
      await openSourcePicker(user);
      const video = (await screen.findByLabelText("Source video preview")) as HTMLVideoElement;
      await waitFor(() =>
        expect(mediaElementSources.filter((source) => source.element === video)).toHaveLength(1),
      );
      const nativeSource = mediaElementSources.find((source) => source.element === video)!;
      await waitFor(() => expect(nativeSource.connectedGain).not.toBeNull());
      const nativeSourceDisconnects = nativeSource.disconnect.mock.calls.length;
      let videoPaused = true;
      Object.defineProperty(video, "paused", {
        configurable: true,
        get: () => videoPaused,
      });
      const videoPlay = vi.fn(async () => {
        videoPaused = false;
        fireEvent.play(video);
      });

      const videoPause = vi.fn(() => {
        videoPaused = true;
      });

      Object.defineProperty(video, "pause", { configurable: true, value: videoPause });
      Object.defineProperty(video, "play", { configurable: true, value: videoPlay });

      await user.click(screen.getByRole("button", { name: "Mute Commentary" }));
      expect(video).toHaveProperty("muted", false);

      Object.defineProperty(video, "currentTime", {
        configurable: true,
        value: 10,
        writable: true,
      });
      fireEvent.timeUpdate(video);
      await user.click(screen.getByRole("button", { name: "Play" }));
      expect(videoPlay).toHaveBeenCalledOnce();
      videoPause.mockClear();

      await user.click(screen.getByRole("button", { name: "Enable Commentary" }));
      await waitFor(() => expect(audioElements).toHaveLength(4));
      expect(screen.queryByTestId("preview-loading-overlay")).not.toBeInTheDocument();
      const transitionAudio = audioElements.slice(2);
      const transitionAudioPlay = transitionAudio.map((audio) =>
        vi.spyOn(audio, "play").mockResolvedValue(),
      );

      for (const audio of transitionAudio) fireEvent.canPlay(audio);
      await waitFor(() =>
        expect(transitionAudioPlay.every((play) => play.mock.calls.length === 1)).toBe(true),
      );

      expect(video).toHaveProperty("muted", false);
      expect(nativeSource.connectedGain?.gain.value).toBe(0);
      expect(nativeSource.disconnect).toHaveBeenCalledTimes(nativeSourceDisconnects);
      expect(transitionAudio.every((audio) => audio.currentTime === 10)).toBe(true);
      expect(videoPlay).toHaveBeenCalledOnce();
      expect(videoPause).not.toHaveBeenCalled();

      const transitionAudioPause = transitionAudio.map((audio) => vi.spyOn(audio, "pause"));
      await user.click(screen.getByRole("button", { name: "Mute Commentary" }));

      await waitFor(() => expect(video).toHaveProperty("muted", false));
      expect(transitionAudioPause.every((pause) => pause.mock.calls.length > 0)).toBe(true);
      expect(videoPlay).toHaveBeenCalledOnce();
      expect(videoPause).not.toHaveBeenCalled();

      await user.click(screen.getByRole("button", { name: "Mute eng" }));
      await user.click(screen.getByRole("button", { name: "Enable Commentary" }));

      await waitFor(() => expect(nativeSource.connectedGain?.gain.value).toBe(0));
      expect(video).toHaveProperty("muted", false);
      expect(nativeSource.disconnect).toHaveBeenCalledTimes(nativeSourceDisconnects);
      expect(videoPlay).toHaveBeenCalledOnce();
      expect(videoPause).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("uses custom audio when a single non-default track is selected", async () => {
    mocks.chooseSource.mockResolvedValue([selection]);
    mocks.inspectMedia.mockResolvedValue({
      ...media,
      audioStreams: [
        ...media.audioStreams,
        {
          streamIndex: 2,
          codecName: "aac",
          channels: 2,
          channelLayout: "stereo",
          sampleRateHz: 48_000,
          title: "Mic",
          isDefault: false,
        },
        {
          streamIndex: 3,
          codecName: "aac",
          channels: 2,
          channelLayout: "stereo",
          sampleRateHz: 48_000,
          title: "Game",
          isDefault: false,
        },
      ],
    });
    mocks.prepareAudioPreviews.mockResolvedValue(
      [1, 2, 3].map((streamIndex) => ({
        mediaToken: 1,
        streamIndex,
        url: `http://easytrim-media.localhost/source-1?variant=audio&stream=${streamIndex}`,
      })),
    );
    const { mediaElementSources } = installAudioMocks();
    const user = userEvent.setup();

    try {
      render(<App />);
      await openSourcePicker(user);
      const video = (await screen.findByLabelText("Source video preview")) as HTMLVideoElement;
      const nativeSource = await waitFor(() => {
        const source = mediaElementSources.find((candidate) => candidate.element === video);
        expect(source?.connectedGain).not.toBeNull();
        return source!;
      });

      await user.click(screen.getByRole("button", { name: "Mute eng" }));
      await user.click(screen.getByRole("button", { name: "Mute Game" }));
      await waitFor(() => expect(nativeSource.connectedGain?.gain.value).toBe(0));

      await user.click(screen.getByRole("button", { name: "Mute Mic" }));
      await user.click(screen.getByRole("button", { name: "Enable Game" }));
      await waitFor(() => expect(nativeSource.connectedGain?.gain.value).toBe(0));
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("opens the source picker with Ctrl+O", () => {
    render(<App />);

    fireEvent.keyDown(window, { key: "щ", code: "KeyO", ctrlKey: true });

    expect(mocks.chooseSource).toHaveBeenCalledTimes(1);
  });

  it("closes the active source with the File menu and Ctrl+Q", async () => {
    mocks.chooseSource.mockResolvedValue([selection]);
    const user = userEvent.setup();
    render(<App />);

    await openSourcePicker(user);
    await waitForSourcePresence(true);

    getMenuTrigger("File").focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("menuitem", { name: /Close File/ })).toHaveTextContent("CtrlQ");
    await user.keyboard("{Escape}");

    fireEvent.keyDown(window, { key: "й", code: "KeyQ", ctrlKey: true });

    await waitForSourcePresence(false);
  });

  it("opens the current source delete dialog with Ctrl+D", async () => {
    mocks.chooseSource.mockResolvedValue([selection]);
    const user = userEvent.setup();
    render(<App />);

    await openSourcePicker(user);
    await waitForSourcePresence(true);

    fireEvent.keyDown(window, { key: "d", code: "KeyD", ctrlKey: true });

    const deleteDialog = await screen.findByRole("alertdialog");
    expect(
      within(deleteDialog).getByRole("heading", { name: "Delete source file?" }),
    ).toBeInTheDocument();
    expect(
      within(deleteDialog).getByText(
        "This deletes holiday.mp4 from your computer. This action can be undone.",
      ),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
  });

  it("imports a selected video and renders the editor with sidebar panels", async () => {
    mocks.chooseSource.mockResolvedValue([selection]);
    const user = userEvent.setup();
    render(<App />);

    await openSourcePicker(user);

    await waitForSourcePresence(true);
    const metadata = screen.getByLabelText("Video metadata");
    expect(metadata).toBeInTheDocument();
    expect(within(metadata).getByText("Filename")).toBeInTheDocument();
    expect(within(metadata).getByText(selection.displayName)).toHaveAttribute(
      "title",
      selection.displayName,
    );
    expect(screen.getByLabelText("Source video preview")).toHaveAttribute(
      "src",
      "http://easytrim-media.localhost/source-1?variant=source",
    );
    expect(screen.getByLabelText("Source video preview")).toHaveAttribute("preload", "auto");
    expect(screen.getByLabelText("Source video preview")).toHaveAttribute("playsinline");
    expect(screen.getByLabelText("Source video preview")).not.toHaveAttribute("controls");
    expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous frame" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next frame" })).toBeInTheDocument();
    const audioPlayhead = document.querySelector(".audio-playhead");
    expect(audioPlayhead).toBeInTheDocument();
    const audioPlayheadGrid = audioPlayhead?.closest('[data-slot="audio-playhead-grid"]');
    expect(audioPlayheadGrid).toHaveAttribute("aria-hidden", "true");
    expect(audioPlayheadGrid).toHaveClass("grid-cols-(--editor-track-grid-columns)");
    expect(audioPlayhead?.parentElement).toHaveAttribute("data-slot", "audio-playhead-track");
    expect(
      screen.getByRole("button", { name: "Set segment start to current position" }),
    ).toHaveAttribute("aria-keyshortcuts", "I");
    expect(
      screen.getByRole("button", { name: "Set segment end to current position" }),
    ).toHaveAttribute("aria-keyshortcuts", "O");
    expect(screen.getByLabelText("Current playback time")).toHaveTextContent(
      "00:00:00:00f / 00:01:04:56f",
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
    expect(document.getElementById("editor-stage")).toBeInTheDocument();
    const videoTimelineRow = screen
      .getByLabelText("Video trim timeline")
      .closest("[data-slot='timeline-row']");

    expect(videoTimelineRow).not.toBeNull();
    const videoToolbar = within(videoTimelineRow as HTMLElement).getByRole("toolbar", {
      name: "Video timeline tools",
    });

    expect(screen.getByText("Tools")).toHaveAttribute("data-slot", "timeline-tools-title");
    expect(videoToolbar).toHaveAttribute("data-slot", "timeline-toolbar");
    expect(videoToolbar).toHaveClass("flex", "items-stretch");
    for (const tool of within(videoToolbar).getAllByRole("button")) {
      expect(tool).toHaveAttribute("data-size", "icon-sm");
    }
    expect(within(videoToolbar).getByRole("button", { name: "Snap playback" })).toBe(
      screen.getByRole("button", { name: "Snap playback" }),
    );
    expect(
      within(videoToolbar)
        .getByRole("button", { name: "Snap playback" })
        .querySelector(".lucide-magnet"),
    ).not.toBeNull();
    expect(within(videoToolbar).getByRole("button", { name: "Loop playback" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      within(videoToolbar)
        .getByRole("button", { name: "Loop playback" })
        .querySelector(".lucide-repeat"),
    ).not.toBeNull();
    expect(within(videoToolbar).getByRole("button", { name: "Segment playback" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      within(videoToolbar)
        .getByRole("button", { name: "Segment playback" })
        .querySelector(".lucide-between-vertical-start"),
    ).not.toBeNull();
    expect(within(videoToolbar).getByRole("button", { name: "Reset tools" })).toHaveAttribute(
      "data-variant",
      "secondary",
    );
    expect(videoToolbar.querySelector('[data-slot="timeline-tools-divider"]')).toHaveClass(
      "mx-1",
      "shrink-0",
      "bg-border",
    );
    expect(
      within(videoToolbar).getByRole("button", { name: "Reset tools" }).parentElement,
    ).toHaveClass("shrink-0", "self-start");
    expect(within(videoToolbar).getByRole("button", { name: "Playback speed" })).toHaveAttribute(
      "data-variant",
      "secondary",
    );
    expect(videoToolbar.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
    const playbackSpeedButton = within(videoToolbar).getByRole("button", {
      name: "Playback speed",
    });

    await user.click(playbackSpeedButton);
    const playbackSpeedSlider = screen.getByRole("slider", { name: "Playback speed" });
    playbackSpeedSlider.focus();
    await user.keyboard("{End}");
    expect(playbackSpeedButton).toHaveAttribute("aria-pressed", "true");
    expect(playbackSpeedButton).toHaveClass("text-primary", "aria-expanded:text-primary");
    fireEvent.doubleClick(playbackSpeedSlider);
    expect(playbackSpeedButton).toHaveAttribute("aria-pressed", "false");
    expect(playbackSpeedButton).not.toHaveClass("text-primary");
    expect(within(videoTimelineRow as HTMLElement).queryByText("Video")).not.toBeInTheDocument();
    const sourceDetailsPanel = document.getElementById("workspace-sidebar");
    expect(sourceDetailsPanel).not.toBeNull();
    expect(sourceDetailsPanel).toContainElement(screen.getByLabelText("Video metadata"));
    expect(sourceDetailsPanel).toContainElement(
      screen.getByRole("button", { name: "Import queue" }),
    );
    expect(sourceDetailsPanel).toContainElement(
      screen.getByRole("heading", { name: "Export queue" }),
    );
    expect(document.getElementById("editor-stage-preview")).toContainElement(
      screen.getByLabelText("Source video preview"),
    );
    expect(document.getElementById("editor-stage-timeline")).toContainElement(
      screen.getByRole("heading", { name: "Selected Segment" }),
    );
    const fixedTimeline = screen.getByTestId("timeline-fixed-content");
    const audioTracksScroll = screen.getByTestId("audio-tracks-scroll");
    const audioPanel = document.getElementById("editor-stage-audio");
    expect(document.getElementById("editor-stage-timeline")).toContainElement(fixedTimeline);
    expect(audioPanel).not.toBeNull();
    expect(audioPanel).toContainElement(audioTracksScroll);
    expect(fixedTimeline).toContainElement(
      screen.getByRole("heading", { name: "Selected Segment" }),
    );
    expect(fixedTimeline).not.toContainElement(
      screen.getByRole("heading", { name: /^Audio tracks/ }),
    );
    expect(audioPanel).toContainElement(screen.getByRole("heading", { name: /^Audio tracks/ }));
    expect(audioTracksScroll).not.toContainElement(
      screen.getByRole("heading", { name: /^Audio tracks/ }),
    );
    expect(audioTracksScroll).toHaveClass("overflow-hidden");
    expect(audioTracksScroll.querySelector('[data-slot="scroll-area-viewport"]')).not.toBeNull();
    expect(screen.queryByTestId("timeline-pane-scroll")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Open a video" })).not.toBeInTheDocument();
    expect(screen.queryByText("Local video editor")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Import a video to inspect its source and prepare a precise cut."),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("banner", { name: "Window title bar" })).toBeInTheDocument();
    expect(getMenuTrigger("File")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    expect(getMenuTrigger("View")).toBeInTheDocument();
  });

  it("renders only the timeline panel when the source has no audio tracks", async () => {
    mocks.chooseSource.mockResolvedValue([selection]);
    mocks.inspectMedia.mockResolvedValue({ ...media, audioStreams: [] });
    const user = userEvent.setup();
    render(<App />);

    await openSourcePicker(user);

    expect(await screen.findByRole("heading", { name: "Selected Segment" })).toBeInTheDocument();
    expect(screen.queryByTestId("audio-tracks-scroll")).not.toBeInTheDocument();
    expect(screen.queryByText("This source has no audio tracks.")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /^Audio tracks/ })).not.toBeInTheDocument();
    expect(document.getElementById("editor-stage-audio")).toBeNull();
  });

  it("closes an open export dialog on Escape", async () => {
    mocks.chooseSource.mockResolvedValue([selection]);
    const user = userEvent.setup();
    render(<App />);

    await openSourcePicker(user);
    await waitForSourcePresence(true);
    getMenuTrigger("File").focus();
    await user.keyboard("{Enter}");
    await user.click(screen.getByRole("menuitem", { name: /Optimize & Export/ }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("keeps a track volume control open while its volume button is hovered", async () => {
    mocks.chooseSource.mockResolvedValue([selection]);
    const user = userEvent.setup();
    render(<App />);

    await openSourcePicker(user);
    await waitForSourcePresence(true);
    const volumeButton = screen.getByRole("button", { name: "Mute eng" });
    expect(volumeButton).not.toHaveAttribute("title");

    await user.hover(volumeButton);
    expect(await screen.findByRole("slider", { name: "eng volume" })).toBeInTheDocument();

    await user.click(volumeButton);
    expect(screen.getByRole("slider", { name: "eng volume" })).toBeInTheDocument();

    await user.unhover(volumeButton);
    await waitFor(() => {
      expect(screen.queryByRole("slider", { name: "eng volume" })).not.toBeInTheDocument();
    });
  });

  it("mutes a track with no meaningful signal and restores it at 0 dB", async () => {
    mocks.chooseSource.mockResolvedValue([selection]);
    mocks.prepareWaveforms.mockImplementationOnce(
      async (_sourcePath: string, jobId: string, streamIndexes: number[], width: number) =>
        streamIndexes.map((streamIndex) => ({
          status: "ready" as const,
          jobId,
          streamIndex,
          width,
          hasSignal: false,
          url: `http://easytrim-media.localhost/1?variant=waveform&stream=${streamIndex}&width=${width}`,
        })),
    );
    const user = userEvent.setup();
    render(<App />);

    await openSourcePicker(user);
    const mutedButton = await screen.findByRole("button", { name: "Enable eng" });
    expect(mutedButton).toHaveAttribute("aria-pressed", "false");

    await user.click(mutedButton);
    const unmutedButton = screen.getByRole("button", { name: "Mute eng" });
    await user.hover(unmutedButton);
    expect(await screen.findByRole("slider", { name: "eng volume" })).toHaveAttribute(
      "aria-valuenow",
      "0",
    );
  });

  it("prepares aligned waveforms and keeps audio output choices in memory", async () => {
    const bounds = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      width: 1_024,
      height: 42,
      top: 0,
      right: 1_024,
      bottom: 42,
      left: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    mocks.chooseSource.mockResolvedValue([selection]);
    mocks.inspectMedia.mockResolvedValue({
      ...media,
      audioStreams: [
        ...media.audioStreams,
        {
          streamIndex: 2,
          codecName: "ac3",
          channels: 6,
          channelLayout: "5.1",
          sampleRateHz: 48_000,
          title: "Commentary",
          isDefault: false,
        },
      ],
    });
    mocks.prepareAudioPreviews.mockResolvedValue([
      {
        mediaToken: 1,
        streamIndex: 1,
        url: "http://easytrim-media.localhost/source-1?variant=audio&stream=1",
      },
      {
        mediaToken: 1,
        streamIndex: 2,
        url: "http://easytrim-media.localhost/source-1?variant=audio&stream=2",
      },
    ]);
    installAudioMocks();
    const user = userEvent.setup();

    try {
      render(<App />);
      await openSourcePicker(user);

      expect(await screen.findByRole("heading", { name: /^Audio tracks/ })).toBeInTheDocument();
      const allTracks = screen.getByRole("button", { name: "All audio tracks" });
      expect(allTracks).toHaveAttribute("aria-pressed", "true");
      expect(allTracks.parentElement).not.toHaveTextContent(/^Audio tracks/);
      expect(screen.getByRole("button", { name: "Mute eng" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      expect(screen.getByRole("button", { name: "Mute Commentary" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      const masterVolume = screen.getByRole("slider", { name: "All audio tracks volume" });
      const masterVolumeControl = masterVolume.closest('[data-slot="slider"]')?.parentElement;
      expect(masterVolume).toHaveAttribute("aria-valuenow", "0");
      masterVolume.focus();
      await user.keyboard("{End}");
      await waitFor(() => expect(masterVolume).toHaveAttribute("aria-valuenow", "6"));
      expect(masterVolumeControl).toHaveTextContent("+6.0 dB");
      fireEvent.doubleClick(masterVolume);
      expect(masterVolume).toHaveAttribute("aria-valuenow", "0");
      expect(masterVolumeControl).toHaveTextContent("+0.0 dB");
      await user.click(screen.getByRole("button", { name: "Mute eng" }));
      expect(screen.getByRole("button", { name: "Enable eng" })).toHaveAttribute(
        "aria-pressed",
        "false",
      );
      await user.click(screen.getByRole("button", { name: "Enable eng" }));
      expect(screen.getByRole("button", { name: "Mute eng" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await waitFor(() =>
        expect(mocks.prepareWaveforms).toHaveBeenCalledWith(
          selection.sourcePath,
          expect.stringMatching(/^waveform-/),
          [1, 2],
          4_096,
        ),
      );
      await waitFor(() =>
        expect(document.querySelectorAll("img[aria-hidden='true']")).toHaveLength(2),
      );

      bounds.mockReturnValue({
        width: 1_536,
        height: 42,
        top: 0,
        right: 1_536,
        bottom: 42,
        left: 0,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      });
      await act(async () => fireEvent(window, new Event("resize")));
      expect(mocks.prepareWaveforms).toHaveBeenCalledTimes(1);

      await user.click(screen.getByRole("button", { name: "Mute Commentary" }));
      expect(allTracks).toHaveAttribute("aria-pressed", "true");
      expect(screen.getByText("1 selected track kept separately")).toBeInTheDocument();
      const mergeAudio = screen.getByRole("checkbox", { name: "Merge selected tracks" });
      await user.hover(mergeAudio);
      expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
      expect(await screen.findByRole("tooltip")).toHaveTextContent(
        "All selected tracks are merged into one track; this requires encoding.",
      );
      await user.click(mergeAudio);
      expect(screen.getByText("One selected track — no merge is needed")).toBeInTheDocument();
      await user.click(allTracks);
      expect(allTracks).toHaveAttribute("aria-pressed", "false");
      expect(screen.getByText(/One selected track/)).toBeInTheDocument();
      await user.click(allTracks);
      expect(allTracks).toHaveAttribute("aria-pressed", "true");
      expect(screen.getByRole("button", { name: "Mute eng" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      expect(screen.getByRole("button", { name: "Enable Commentary" })).toHaveAttribute(
        "aria-pressed",
        "false",
      );
    } finally {
      bounds.mockRestore();
      vi.unstubAllGlobals();
    }
  }, 10_000);

  it("keeps tracks enabled when waveform preparation fails and retries per track", async () => {
    const bounds = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      width: 896,
      height: 42,
      top: 0,
      right: 896,
      bottom: 42,
      left: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    mocks.chooseSource.mockResolvedValue([selection]);
    mocks.prepareWaveforms
      .mockImplementationOnce(
        async (_sourcePath: string, jobId: string, streamIndexes: number[], width: number) =>
          streamIndexes.map((streamIndex) => ({
            status: "failed" as const,
            jobId,
            streamIndex,
            width,
            error: { code: "waveform_failed", message: "Could not decode this track." },
          })),
      )
      .mockImplementationOnce(
        async (_sourcePath: string, jobId: string, streamIndexes: number[], width: number) =>
          streamIndexes.map((streamIndex) => ({
            status: "ready" as const,
            jobId,
            streamIndex,
            width,
            url: `http://easytrim-media.localhost/1?variant=waveform&stream=${streamIndex}&width=${width}`,
          })),
      );
    const user = userEvent.setup();

    try {
      render(<App />);
      await openSourcePicker(user);

      const retry = await screen.findByRole("button", { name: "Retry" });
      expect(screen.getByRole("button", { name: "Mute eng" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await user.click(retry);
      await waitFor(() => expect(document.querySelector(".waveform-image")).not.toBeNull());
      expect(mocks.prepareWaveforms).toHaveBeenCalledTimes(2);
    } finally {
      bounds.mockRestore();
    }
  });

  it("plays, pauses, and steps by the source fractional frame rate", async () => {
    mocks.chooseSource.mockResolvedValue([selection]);
    const user = userEvent.setup();
    render(<App />);

    await openSourcePicker(user);
    const video = (await screen.findByLabelText("Source video preview")) as HTMLVideoElement;
    const play = vi.spyOn(video, "play").mockResolvedValue();
    const pause = vi.spyOn(video, "pause").mockImplementation(() => undefined);

    await user.click(screen.getByRole("button", { name: "Play" }));
    expect(play).toHaveBeenCalledOnce();

    fireEvent.play(video);
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Next frame" }));
    expect(pause).toHaveBeenCalled();
    const playhead = screen.getByRole("slider", { name: "Playback position" });
    const audioPlayhead = document.querySelector(".audio-playhead") as HTMLElement;
    expect(playhead).toHaveAttribute("aria-valuenow", "16683");
    expect(audioPlayhead.style.left).toBe(playhead.style.left);
    expect(screen.getByLabelText("Current playback time")).toHaveTextContent("00:00:00:01f");

    await user.click(screen.getByRole("button", { name: "Previous frame" }));
    expect(screen.getByLabelText("Current playback time")).toHaveTextContent("00:00:00:00f");
    expect(audioPlayhead.style.left).toBe(playhead.style.left);

    video.currentTime = 10;
    fireEvent.timeUpdate(video);
    expect(audioPlayhead.style.left).toBe(playhead.style.left);
  });

  it("stops all media and remains restartable when independent audio cannot play", async () => {
    mocks.chooseSource.mockResolvedValue([selection]);
    mocks.inspectMedia.mockResolvedValue({
      ...media,
      audioStreams: [
        ...media.audioStreams,
        {
          streamIndex: 2,
          codecName: "aac",
          channels: 2,
          channelLayout: "stereo",
          sampleRateHz: 48_000,
          language: "commentary",
          isDefault: false,
        },
      ],
    });
    mocks.prepareAudioPreviews.mockResolvedValue([
      {
        mediaToken: 1,
        streamIndex: 1,
        url: "http://easytrim-media.localhost/source-1?variant=audio&stream=1",
      },
      {
        mediaToken: 1,
        streamIndex: 2,
        url: "http://easytrim-media.localhost/source-1?variant=audio&stream=2",
      },
    ]);
    const user = userEvent.setup();
    const audioElements = [document.createElement("audio"), document.createElement("audio")];
    const audioPlay = vi
      .fn()
      .mockRejectedValueOnce(new DOMException("Playback interrupted", "AbortError"))
      .mockRejectedValueOnce(new DOMException("Playback interrupted", "AbortError"));

    const audioPause = vi.fn();
    for (const element of audioElements) {
      Object.defineProperty(element, "pause", { configurable: true, value: audioPause });
      Object.defineProperty(element, "play", { configurable: true, value: audioPlay });
    }
    const audioConstructor = vi.fn(function AudioMock() {
      return audioElements.shift();
    });

    const audioContext = {
      destination: {},
      resume: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      createGain: vi.fn(() => ({
        gain: { value: 1 },
        connect: vi.fn(),
        disconnect: vi.fn(),
      })),
      createMediaElementSource: vi.fn(() => ({
        connect: vi.fn((destination: unknown) => destination),
        disconnect: vi.fn(),
      })),
    };

    vi.stubGlobal("Audio", audioConstructor);
    vi.stubGlobal(
      "AudioContext",
      vi.fn(function AudioContextMock() {
        return audioContext;
      }),
    );

    try {
      render(<App />);
      await openSourcePicker(user);
      const video = (await screen.findByLabelText("Source video preview")) as HTMLVideoElement;
      await waitFor(() => expect(audioConstructor).toHaveBeenCalledTimes(2));
      const videoPlay = vi.spyOn(video, "play").mockImplementation(async () => {
        fireEvent.play(video);
      });

      const videoPause = vi.spyOn(video, "pause").mockImplementation(() => undefined);

      await user.click(screen.getByRole("button", { name: "Play" }));

      expect(await screen.findByRole("alert")).toHaveTextContent("Playback could not start.");
      expect(audioContext.resume).toHaveBeenCalledOnce();
      expect(videoPause).toHaveBeenCalledOnce();
      expect(audioPause).toHaveBeenCalled();
      expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();

      audioPlay.mockResolvedValue(undefined);
      await user.click(screen.getByRole("button", { name: "Play" }));

      await waitFor(() => expect(videoPlay).toHaveBeenCalledTimes(2));
      expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("stops preview playback when the preview errors", async () => {
    mocks.chooseSource.mockResolvedValue([selection]);
    const user = userEvent.setup();

    render(<App />);
    await openSourcePicker(user);

    const video = (await screen.findByLabelText("Source video preview")) as HTMLVideoElement;
    const videoPause = vi.spyOn(video, "pause").mockImplementation(() => undefined);

    fireEvent.play(video);
    fireEvent.error(video);

    expect(videoPause).toHaveBeenCalled();
    expect(await screen.findByLabelText("Source video preview")).toHaveAttribute(
      "data-preview-kind",
      "proxy",
    );
  });

  it("rebuilds source-bound audio runtime when a proxy preview replaces the source preview", async () => {
    mocks.chooseSource.mockResolvedValue([selection]);
    mocks.inspectMedia.mockResolvedValue({
      ...media,
      audioStreams: [
        ...media.audioStreams,
        {
          streamIndex: 2,
          codecName: "aac",
          channels: 2,
          channelLayout: "stereo",
          sampleRateHz: 48_000,
          language: "commentary",
          isDefault: false,
        },
      ],
    });
    mocks.prepareAudioPreviews.mockResolvedValue([
      {
        mediaToken: 1,
        streamIndex: 1,
        url: "http://easytrim-media.localhost/source-1?variant=audio&stream=1",
      },
      {
        mediaToken: 1,
        streamIndex: 2,
        url: "http://easytrim-media.localhost/source-1?variant=audio&stream=2",
      },
    ]);
    const { audioConstructor, audioElements } = installAudioMocks();
    const user = userEvent.setup();

    try {
      render(<App />);
      await openSourcePicker(user);
      await screen.findByLabelText("Source video preview");
      await waitFor(() => expect(audioConstructor).toHaveBeenCalledTimes(2));

      fireEvent.error(screen.getByLabelText("Source video preview"));
      await screen.findByText("Compatible preview");
      await waitFor(() => expect(audioConstructor).toHaveBeenCalledTimes(4));

      expect(audioElements.slice(0, 2).every((element) => !document.body.contains(element))).toBe(
        true,
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("stops or loops at the selected segment boundary", async () => {
    mocks.chooseSource.mockResolvedValue([selection]);
    const user = userEvent.setup();
    render(<App />);

    await openSourcePicker(user);
    const video = (await screen.findByLabelText("Source video preview")) as HTMLVideoElement;
    let paused = true;
    Object.defineProperty(video, "paused", { configurable: true, get: () => paused });
    const play = vi.spyOn(video, "play").mockImplementation(() => {
      paused = false;
      return Promise.resolve();
    });

    const pause = vi.spyOn(video, "pause").mockImplementation(() => {
      paused = true;
    });

    video.currentTime = 10;
    fireEvent.timeUpdate(video);
    fireEvent.keyDown(window, { key: "i", code: "KeyI" });
    video.currentTime = 20;
    fireEvent.timeUpdate(video);
    fireEvent.keyDown(window, { key: "o", code: "KeyO" });

    const segmentToggle = screen.getByRole("button", { name: "Segment playback" });
    const loopToggle = screen.getByRole("button", { name: "Loop playback" });
    const playhead = screen.getByRole("slider", { name: "Playback position" });
    expect(segmentToggle).toHaveAttribute("aria-pressed", "true");
    await user.click(loopToggle);
    expect(loopToggle).toHaveAttribute("aria-pressed", "false");

    video.currentTime = 25;
    fireEvent.timeUpdate(video);
    await user.click(screen.getByRole("button", { name: "Play" }));
    expect(video.currentTime).toBe(25);
    fireEvent.play(video);
    video.currentTime = 65.25;
    fireEvent.timeUpdate(video);

    expect(pause).toHaveBeenCalled();
    expect(playhead).toHaveAttribute("aria-valuenow", "65000000");
    expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();

    pause.mockClear();
    await user.click(loopToggle);
    video.currentTime = 25;
    fireEvent.timeUpdate(video);
    await user.click(screen.getByRole("button", { name: "Play" }));
    fireEvent.play(video);
    video.currentTime = 65.25;
    fireEvent.timeUpdate(video);

    expect(loopToggle).toHaveAttribute("aria-pressed", "true");
    expect(pause).not.toHaveBeenCalled();
    expect(video.currentTime).toBe(10);
    expect(playhead).toHaveAttribute("aria-valuenow", "10000000");
    expect(play).toHaveBeenCalledTimes(2);
  });

  it("restarts the complete timeline after the video ends when looping is enabled", async () => {
    mocks.chooseSource.mockResolvedValue([selection]);
    const user = userEvent.setup();
    render(<App />);

    await openSourcePicker(user);
    const video = (await screen.findByLabelText("Source video preview")) as HTMLVideoElement;
    const play = vi.spyOn(video, "play").mockResolvedValue();
    vi.spyOn(video, "pause").mockImplementation(() => undefined);

    const segmentToggle = screen.getByRole("button", { name: "Segment playback" });
    await user.click(segmentToggle);
    expect(segmentToggle).toHaveAttribute("aria-pressed", "false");
    expect(video.loop).toBe(true);
    await user.click(screen.getByRole("button", { name: "Play" }));
    fireEvent.play(video);
    video.currentTime = 65;
    fireEvent.ended(video);

    expect(video.currentTime).toBe(0);
    expect(screen.getByRole("slider", { name: "Playback position" })).toHaveAttribute(
      "aria-valuenow",
      "0",
    );
    await waitFor(() => expect(play).toHaveBeenCalledTimes(2));
  });

  it("prioritizes playback while keeping other shortcuts locked during text entry", async () => {
    mocks.chooseSource.mockResolvedValue([selection]);
    const user = userEvent.setup();
    render(<App />);

    await openSourcePicker(user);
    const video = (await screen.findByLabelText("Source video preview")) as HTMLVideoElement;
    const play = vi.spyOn(video, "play").mockResolvedValue();
    const pause = vi.spyOn(video, "pause").mockImplementation(() => undefined);

    fireEvent.keyDown(window, { key: "ArrowRight", code: "ArrowRight" });
    expect(screen.getByRole("slider", { name: "Playback position" })).toHaveAttribute(
      "aria-valuenow",
      "16683",
    );

    fireEvent.keyDown(window, { key: "ArrowLeft", code: "ArrowLeft" });
    expect(screen.getByRole("slider", { name: "Playback position" })).toHaveAttribute(
      "aria-valuenow",
      "0",
    );

    fireEvent.keyDown(window, { key: " ", code: "Space" });
    expect(play).toHaveBeenCalledOnce();
    fireEvent.play(video);
    pause.mockClear();
    fireEvent.keyDown(window, { key: " ", code: "Space" });
    expect(pause).toHaveBeenCalledOnce();
    fireEvent.pause(video);

    const input = document.createElement("input");
    document.body.append(input);
    input.focus();
    play.mockClear();
    pause.mockClear();
    fireEvent.keyDown(input, { key: " ", code: "Space" });
    fireEvent.keyDown(input, { key: "ArrowRight", code: "ArrowRight" });
    expect(play).toHaveBeenCalledOnce();
    expect(pause).not.toHaveBeenCalled();
    expect(screen.getByRole("slider", { name: "Playback position" })).toHaveAttribute(
      "aria-valuenow",
      "0",
    );
    input.remove();
  });

  it("removes the editor shortcut listener when the preview unmounts", async () => {
    mocks.chooseSource.mockResolvedValue([selection]);
    const removeEventListener = vi.spyOn(window, "removeEventListener");
    const user = userEvent.setup();
    const view = render(<App />);

    await openSourcePicker(user);
    await screen.findByLabelText("Source video preview");
    view.unmount();

    expect(removeEventListener).toHaveBeenCalledWith("keydown", expect.any(Function), true);
    removeEventListener.mockRestore();
  });

  it("sets segment boundaries at the playhead with crossing and edge safeguards", async () => {
    mocks.chooseSource.mockResolvedValue([selection]);
    const user = userEvent.setup();
    render(<App />);

    await openSourcePicker(user);
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
    fireEvent.keyDown(window, { key: "i", code: "KeyI" });
    expect(startHandle).toHaveAttribute("aria-valuenow", "10000000");

    video.currentTime = 5;
    fireEvent.timeUpdate(video);
    fireEvent.keyDown(window, { key: "o", code: "KeyO" });
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
    mocks.chooseSource.mockResolvedValue([selection]);
    const user = userEvent.setup();
    render(<App />);

    await openSourcePicker(user);
    const directPreview = await screen.findByLabelText("Source video preview");
    fireEvent.error(directPreview);

    await waitFor(() => {
      expect(mocks.prepareProxyPreview).toHaveBeenCalledWith(selection.sourcePath);
    });
    expect(await screen.findByText("Compatible preview")).toBeInTheDocument();
    expect(screen.getByLabelText("Source video preview")).toHaveAttribute(
      "src",
      "http://easytrim-media.localhost/source-1?variant=proxy",
    );
  });

  it("exposes keyboard-accessible trim handles and updates the source range", async () => {
    mocks.chooseSource.mockResolvedValue([selection]);
    const user = userEvent.setup();
    render(<App />);

    await openSourcePicker(user);
    const startHandle = await screen.findByRole("slider", { name: "Trim start" });
    const endHandle = screen.getByRole("slider", { name: "Trim end" });

    expect(startHandle).toHaveAttribute("aria-valuenow", "0");
    expect(endHandle).toHaveAttribute("aria-valuenow", "65000000");

    startHandle.focus();
    await user.keyboard("{ArrowRight}");

    expect(startHandle).toHaveAttribute("aria-valuenow", "16683");
    expect(screen.getAllByText("00:00:00:01f")).not.toHaveLength(0);
  });

  it("maps pointer movement on a trim handle to source time", async () => {
    mocks.chooseSource.mockResolvedValue([selection]);
    const user = userEvent.setup();
    render(<App />);

    await openSourcePicker(user);
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

    expect(document.querySelector("[data-slot='timeline-pane']")).toHaveStyle({
      "--timeline-trim-start": "25%",
    });

    await flushAnimationFrame();

    expect(screen.getByRole("slider", { name: "Trim start" })).toHaveAttribute(
      "aria-valuenow",
      "16250000",
    );
    expect(screen.getAllByText("00:00:16:14f")).not.toHaveLength(0);

    fireEvent.pointerDown(screen.getByRole("slider", { name: "Trim end" }), {
      clientX: 100 + (16.75 / 65) * 1000,
      pointerId: 2,
    });
    await flushAnimationFrame();
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
    mocks.chooseSource.mockResolvedValue([selection]);
    const user = userEvent.setup();
    render(<App />);

    await openSourcePicker(user);
    const video = (await screen.findByLabelText("Source video preview")) as HTMLVideoElement;
    const startHandle = screen.getByRole("slider", { name: "Trim start" });
    const endHandle = screen.getByRole("slider", { name: "Trim end" });
    const playhead = screen.getByRole("slider", { name: "Playback position" });

    video.currentTime = 10;
    fireEvent.timeUpdate(video);
    fireEvent.keyDown(window, { key: "i", code: "KeyI" });
    video.currentTime = 50;
    fireEvent.timeUpdate(video);
    fireEvent.keyDown(window, { key: "o", code: "KeyO" });
    video.currentTime = 30;
    fireEvent.timeUpdate(video);

    fireEvent.doubleClick(startHandle);
    expect(startHandle).toHaveAttribute("aria-valuenow", "0");
    expect(endHandle).toHaveAttribute("aria-valuenow", "50000000");
    expect(playhead).toHaveAttribute("aria-valuenow", "30000000");

    fireEvent.doubleClick(endHandle);
    expect(endHandle).toHaveAttribute("aria-valuenow", "65000000");
    expect(playhead).toHaveAttribute("aria-valuenow", "30000000");
    await user.hover(startHandle);
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Trim start");
  });

  it("resumes playback after both pointer cycles of a trim-handle double-click", async () => {
    mocks.chooseSource.mockResolvedValue([selection]);
    const user = userEvent.setup();
    render(<App />);

    await openSourcePicker(user);
    const video = (await screen.findByLabelText("Source video preview")) as HTMLVideoElement;
    const play = vi.spyOn(video, "play").mockResolvedValue();
    vi.spyOn(video, "pause").mockImplementation(() => undefined);
    const startHandle = screen.getByRole("slider", { name: "Trim start" });
    fireEvent.play(video);

    await user.dblClick(startHandle);

    expect(play).toHaveBeenCalledTimes(2);
    fireEvent.play(video);
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();
  });

  it("drags the complete segment without resizing it or moving the playhead", async () => {
    mocks.chooseSource.mockResolvedValue([selection]);
    const user = userEvent.setup();
    render(<App />);

    await openSourcePicker(user);
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
    fireEvent.keyDown(window, { key: "i", code: "KeyI" });
    video.currentTime = 20;
    fireEvent.timeUpdate(video);
    fireEvent.keyDown(window, { key: "o", code: "KeyO" });
    video.currentTime = 30;
    fireEvent.timeUpdate(video);

    const snapPlaybackToggle = screen.getByRole("button", { name: "Snap playback" });
    await user.click(snapPlaybackToggle);
    expect(snapPlaybackToggle).toHaveAttribute("aria-pressed", "false");

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

  it("snaps all dragged segment points regardless of the snap-playback state", async () => {
    mocks.chooseSource.mockResolvedValue([selection]);
    const user = userEvent.setup();
    render(<App />);

    await openSourcePicker(user);
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
    fireEvent.keyDown(window, { key: "i", code: "KeyI" });
    video.currentTime = 20;
    fireEvent.timeUpdate(video);
    fireEvent.keyDown(window, { key: "o", code: "KeyO" });
    video.currentTime = 30;
    fireEvent.timeUpdate(video);

    const snapPlaybackToggle = screen.getByRole("button", { name: "Snap playback" });
    await user.click(snapPlaybackToggle);
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
    await flushAnimationFrame();
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
    await flushAnimationFrame();
    expect(segmentHandle).toHaveAttribute("data-snap-point", "end");
    expect(screen.getByRole("slider", { name: "Trim start" })).toHaveAttribute(
      "aria-valuenow",
      "20000000",
    );

    fireEvent.pointerMove(segmentHandle, {
      clientX: clientXForSeconds(24.5),
      pointerId: 33,
    });
    await flushAnimationFrame();
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
    await flushAnimationFrame();
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
    await flushAnimationFrame();
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

    await user.click(snapPlaybackToggle);
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
    await flushAnimationFrame();
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
    await flushAnimationFrame();
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
    await flushAnimationFrame();
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
    mocks.chooseSource.mockResolvedValue([selection]);
    const user = userEvent.setup();
    render(<App />);

    await openSourcePicker(user);
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
    fireEvent.keyDown(window, { key: "i", code: "KeyI" });
    video.currentTime = 20;
    fireEvent.timeUpdate(video);
    fireEvent.keyDown(window, { key: "o", code: "KeyO" });
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
    await flushAnimationFrame();
    expect(segmentHandle).toHaveAttribute("data-snap-point", "start");
    expect(trimStart).toHaveAttribute("aria-valuenow", "30000000");
    expect(playhead).toHaveAttribute("aria-valuenow", "30000000");

    fireEvent.pointerMove(segmentHandle, {
      clientX: clientXForSeconds(36),
      pointerId: 37,
      shiftKey: true,
    });
    await flushAnimationFrame();
    expect(segmentHandle).not.toHaveAttribute("data-snap-point");
    expect(trimStart).toHaveAttribute("aria-valuenow", "31000000");
    expect(playhead).toHaveAttribute("aria-valuenow", "31000000");

    fireEvent.pointerMove(segmentHandle, {
      clientX: clientXForSeconds(36.5),
      pointerId: 37,
      shiftKey: true,
    });
    await flushAnimationFrame();
    expect(segmentHandle).not.toHaveAttribute("data-snap-point");
    expect(trimStart).toHaveAttribute("aria-valuenow", "31500000");
    expect(playhead).toHaveAttribute("aria-valuenow", "31500000");

    fireEvent.pointerMove(segmentHandle, {
      clientX: clientXForSeconds(36.3),
      pointerId: 37,
      shiftKey: true,
    });
    await flushAnimationFrame();
    expect(segmentHandle).toHaveAttribute("data-snap-point", "start");
    expect(trimStart).toHaveAttribute("aria-valuenow", "31500000");
    fireEvent.pointerUp(segmentHandle, {
      clientX: clientXForSeconds(36.3),
      pointerId: 37,
      shiftKey: true,
    });
  });

  it("catches and follows the playhead while safely dragging the segment", async () => {
    mocks.chooseSource.mockResolvedValue([selection]);
    const user = userEvent.setup();
    render(<App />);

    await openSourcePicker(user);
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
    fireEvent.keyDown(window, { key: "i", code: "KeyI" });
    video.currentTime = 20;
    fireEvent.timeUpdate(video);
    fireEvent.keyDown(window, { key: "o", code: "KeyO" });
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
    await flushAnimationFrame();
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
    await flushAnimationFrame();
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
    await flushAnimationFrame();
    expect(playhead).toHaveAttribute("aria-valuenow", "30000000");
    expect(video.currentTime).toBe(30);
    fireEvent.pointerUp(segmentHandle, {
      clientX: clientXForSeconds(35),
      pointerId: 41,
    });
  });

  it("moves the playhead only when a shrinking trim handle crosses it", async () => {
    mocks.chooseSource.mockResolvedValue([selection]);
    const user = userEvent.setup();
    render(<App />);

    await openSourcePicker(user);
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
    const dragBoundaryTo = async (name: "Trim start" | "Trim end", seconds: number) => {
      fireEvent.pointerDown(screen.getByRole("slider", { name }), {
        clientX: clientXForSeconds(seconds),
        pointerId: 1,
      });
      await flushAnimationFrame();
    };

    await dragBoundaryTo("Trim start", 10);
    expect(playhead).toHaveAttribute("aria-valuenow", "30000000");
    expect(video.currentTime).toBe(30);

    await dragBoundaryTo("Trim start", 40);
    expect(playhead).toHaveAttribute("aria-valuenow", "40000000");
    expect(video.currentTime).toBe(40);

    await dragBoundaryTo("Trim start", 20);
    expect(playhead).toHaveAttribute("aria-valuenow", "40000000");
    expect(video.currentTime).toBe(40);

    await dragBoundaryTo("Trim end", 50);
    expect(playhead).toHaveAttribute("aria-valuenow", "40000000");
    expect(video.currentTime).toBe(40);

    await dragBoundaryTo("Trim end", 30);
    expect(playhead).toHaveAttribute("aria-valuenow", "30000000");
    expect(video.currentTime).toBe(30);

    await dragBoundaryTo("Trim end", 50);
    expect(playhead).toHaveAttribute("aria-valuenow", "30000000");
    expect(video.currentTime).toBe(30);
  });

  it("lets the snap-playback toggle disable and restore playhead following", async () => {
    mocks.chooseSource.mockResolvedValue([selection]);
    const user = userEvent.setup();
    render(<App />);

    await openSourcePicker(user);
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
    const snapPlaybackToggle = screen.getByRole("button", { name: "Snap playback" });
    const playhead = screen.getByRole("slider", { name: "Playback position" });

    video.currentTime = 30;
    fireEvent.timeUpdate(video);
    expect(snapPlaybackToggle).toHaveAttribute("aria-pressed", "true");

    await user.click(snapPlaybackToggle);
    expect(snapPlaybackToggle).toHaveAttribute("aria-pressed", "false");
    fireEvent.pointerDown(screen.getByRole("slider", { name: "Trim start" }), {
      clientX: clientXForSeconds(40),
      pointerId: 20,
    });
    expect(playhead).toHaveAttribute("aria-valuenow", "30000000");

    fireEvent.pointerDown(screen.getByRole("slider", { name: "Trim start" }), {
      clientX: clientXForSeconds(20),
      pointerId: 21,
    });
    await user.click(snapPlaybackToggle);
    fireEvent.pointerDown(screen.getByRole("slider", { name: "Trim start" }), {
      clientX: clientXForSeconds(35),
      pointerId: 22,
    });
    await flushAnimationFrame();
    expect(snapPlaybackToggle).toHaveAttribute("aria-pressed", "true");
    expect(playhead).toHaveAttribute("aria-valuenow", "35000000");
    expect(video.currentTime).toBe(35);
  });

  it("holds a safely followed trim border through the snap radius before releasing it", async () => {
    mocks.chooseSource.mockResolvedValue([selection]);
    const user = userEvent.setup();
    render(<App />);

    await openSourcePicker(user);
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
    await flushAnimationFrame();
    expect(trimStart).toHaveAttribute("data-snap-active", "true");
    expect(trimStart).toHaveAttribute("aria-valuenow", "30000000");
    expect(playhead).toHaveAttribute("aria-valuenow", "30000000");

    fireEvent.pointerMove(trimStart, {
      clientX: clientXForSeconds(31),
      pointerId: 23,
      shiftKey: true,
    });
    await flushAnimationFrame();
    expect(trimStart).not.toHaveAttribute("data-snap-active");
    expect(trimStart).toHaveAttribute("aria-valuenow", "31000000");
    expect(playhead).toHaveAttribute("aria-valuenow", "31000000");

    fireEvent.pointerMove(trimStart, {
      clientX: clientXForSeconds(31.5),
      pointerId: 23,
      shiftKey: true,
    });
    await flushAnimationFrame();
    expect(trimStart).not.toHaveAttribute("data-snap-active");
    expect(trimStart).toHaveAttribute("aria-valuenow", "31500000");
    expect(playhead).toHaveAttribute("aria-valuenow", "31500000");

    fireEvent.pointerMove(trimStart, {
      clientX: clientXForSeconds(31.3),
      pointerId: 23,
      shiftKey: true,
    });
    await flushAnimationFrame();
    expect(trimStart).toHaveAttribute("data-snap-active", "true");
    expect(trimStart).toHaveAttribute("aria-valuenow", "31500000");
    fireEvent.pointerUp(trimStart, {
      pointerId: 23,
      shiftKey: true,
    });
  });

  it("uses Shift to snap playhead and trim-handle drags to each other", async () => {
    mocks.chooseSource.mockResolvedValue([selection]);
    const user = userEvent.setup();
    render(<App />);

    await openSourcePicker(user);
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
    fireEvent.keyDown(window, { key: "i", code: "KeyI" });
    video.currentTime = 50;
    fireEvent.timeUpdate(video);
    fireEvent.keyDown(window, { key: "o", code: "KeyO" });

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
    await flushAnimationFrame();
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
    await flushAnimationFrame();
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

  it("resumes playback immediately while the browser settles a scrub seek", async () => {
    mocks.chooseSource.mockResolvedValue([selection]);
    const user = userEvent.setup();
    render(<App />);

    await openSourcePicker(user);
    const video = (await screen.findByLabelText("Source video preview")) as HTMLVideoElement;
    const play = vi.spyOn(video, "play").mockResolvedValue();
    vi.spyOn(video, "pause").mockImplementation(() => undefined);
    let currentTime = video.currentTime;
    let seekAssignments = 0;
    Object.defineProperty(video, "currentTime", {
      configurable: true,
      get: () => currentTime,
      set: (seconds: number) => {
        currentTime = seconds;
        seekAssignments += 1;
      },
    });
    const timeline = screen.getByLabelText("Video trim timeline");
    const measureTimeline = vi.spyOn(timeline, "getBoundingClientRect").mockReturnValue({
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
    expect(screen.getByLabelText("Current playback time")).toHaveTextContent("00:00:32:28f");

    let seeking = true;
    Object.defineProperty(video, "seeking", {
      configurable: true,
      get: () => seeking,
    });
    fireEvent.pointerUp(playhead, { clientX: 600, pointerId: 7 });
    expect(play).toHaveBeenCalledOnce();
    expect(seekAssignments).toBe(1);
    expect(measureTimeline).toHaveBeenCalledOnce();

    seeking = false;
    fireEvent.seeked(video);
    expect(play).toHaveBeenCalledOnce();
  });

  it("blocks timeline shortcuts while a timeline control is being scrubbed", async () => {
    mocks.chooseSource.mockResolvedValue([selection]);
    const user = userEvent.setup();
    render(<App />);

    await openSourcePicker(user);
    const video = (await screen.findByLabelText("Source video preview")) as HTMLVideoElement;
    const play = vi.spyOn(video, "play").mockResolvedValue();
    vi.spyOn(video, "pause").mockImplementation(() => undefined);
    const playhead = screen.getByRole("slider", { name: "Playback position" });
    const initialPosition = playhead.getAttribute("aria-valuenow");

    fireEvent.pointerDown(playhead, { clientX: 100, pointerId: 21 });
    fireEvent.keyDown(window, { key: "ArrowRight", code: "ArrowRight" });
    fireEvent.keyDown(window, { key: " ", code: "Space" });

    expect(play).not.toHaveBeenCalled();
    expect(playhead).toHaveAttribute("aria-valuenow", initialPosition);

    fireEvent.pointerUp(playhead, { pointerId: 21 });
    fireEvent.keyDown(window, { key: " ", code: "Space" });
    expect(play).toHaveBeenCalledOnce();
  });

  it("synchronizes the timeline playhead with video playback", async () => {
    mocks.chooseSource.mockResolvedValue([selection]);
    const user = userEvent.setup();
    render(<App />);

    await openSourcePicker(user);
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
    mocks.chooseSource.mockResolvedValue([selection]);
    const user = userEvent.setup();
    render(<App />);

    await openSourcePicker(user);
    fireEvent.error(await screen.findByLabelText("Source video preview"));
    const proxyPreview = await screen.findByText("Compatible preview");
    expect(proxyPreview).toBeInTheDocument();
    fireEvent.error(screen.getByLabelText("Source video preview"));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The compatible preview could not be played.",
    );
    expect(selectHasSource(store.getState())).toBe(true);
  });

  it("keeps the current source when the picker is cancelled", async () => {
    mocks.chooseSource.mockResolvedValueOnce([selection]).mockResolvedValueOnce([]);
    const user = userEvent.setup();
    render(<App />);

    await openSourcePicker(user);
    await waitForSourcePresence(true);

    getMenuTrigger("File").focus();
    await user.keyboard("{Enter}");
    await user.click(screen.getByRole("menuitem", { name: /Open File/ }));

    expect(selectHasSource(store.getState())).toBe(true);
    expect(mocks.inspectMedia).toHaveBeenCalledTimes(1);
  });

  it("shows a clear missing-binary capability state", async () => {
    mocks.checkMediaCapabilities.mockResolvedValue({
      ffmpeg: { available: false, error: "ffmpeg is not installed or available on PATH." },
      ffprobe: { available: false, error: "ffprobe is not installed or available on PATH." },
    });
    await store.dispatch(checkMediaCapabilitiesRequested());
    render(<App />);

    expect(await screen.findByText("Media tools unavailable")).toBeInTheDocument();
    expect(
      screen.getByRole("status", { name: /FFprobe: ffprobe is not installed/ }),
    ).toBeInTheDocument();
  });

  it("replaces the current source with a failed dropped import", async () => {
    mocks.chooseSource.mockResolvedValue([selection]);
    const user = userEvent.setup();
    render(<App />);

    await openSourcePicker(user);
    await waitForSourcePresence(true);

    act(() => {
      sourceDropListener?.({
        status: "failed",
        error: { code: "unsupported_media", message: "This file type is not supported yet." },
      });
    });

    expect(selectHasSource(store.getState())).toBe(false);
    expect(screen.getAllByRole("alert")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ textContent: expect.stringContaining("This file type") }),
      ]),
    );
  });

  it("inspects a source selected by the native drop listener", async () => {
    render(<App />);

    act(() => {
      sourceDropListener?.({ status: "selected", sources: [selection] });
    });

    await waitForSourcePresence(true);
    expect(mocks.inspectMedia).toHaveBeenCalledWith(selection.sourcePath);
    expect(await screen.findByLabelText("Source video preview")).toBeInTheDocument();
  });

  it("shows the native drag overlay over the full app", async () => {
    mocks.chooseSource.mockResolvedValue([selection]);
    const user = userEvent.setup();
    render(<App />);

    await openSourcePicker(user);
    await waitForSourcePresence(true);

    act(() => sourceDropListener?.({ status: "drag", active: true }));
    expect(screen.getByRole("status", { name: "Drop video to open" })).toHaveClass(
      "fixed",
      "inset-0",
    );

    act(() => sourceDropListener?.({ status: "drag", active: false }));
    expect(screen.queryByRole("status", { name: "Drop video to open" })).not.toBeInTheDocument();
  });

  it("cleans up the native source-drop listener when the app runtime stops", async () => {
    render(<App />);
    await waitFor(() => expect(sourceDropListener).toBeDefined());

    stopSourceMediaRuntime?.();

    expect(mocks.unlistenDrops).toHaveBeenCalledOnce();
  });
});

async function flushAnimationFrame() {
  await act(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      }),
  );
}

import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_PREFERENCES } from "../app/preferences";
import { editingInstanceActivated } from "../app/store/actions/editing-instance-actions";
import { sourceCleared, sourceReady } from "../app/store/actions/source-actions";
import { startSourceMediaRuntime } from "../app/store/integration/source-media-runtime";
import {
  editingInstanceClosed,
  editingInstancesAdded,
  selectActiveInstanceId,
  selectEditingInstances,
} from "../app/store/slices/editing-instances-slice";
import {
  createEditorToolsStateFromPreferences,
  editorToolsInitialized,
} from "../app/store/slices/editor-tools-slice";
import { previewReady } from "../app/store/slices/preview-slice";
import { selectHasSource, selectSourceSelection } from "../app/store/slices/source-slice";
import { store } from "../app/store/store";
import { checkMediaCapabilitiesRequested } from "../app/store/thunks/source-media-thunks";
import type { AudioTrackProcessing } from "../domain/audio-processing";
import type { EditingInstanceListEntry } from "../domain/editing-instance";
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
  prepareImportedSourceThumbnail: vi.fn(),
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
    prepareImportedSourceThumbnail: mocks.prepareImportedSourceThumbnail,
    prepareProxyPreview: mocks.prepareProxyPreview,
    prepareSourcePreview: mocks.prepareSourcePreview,
    prepareWaveforms: mocks.prepareWaveforms,
  };
});

vi.mock("react-virtuoso", async () => {
  const React = await import("react");
  return {
    Virtuoso: (props: {
      context?: unknown;
      data?: readonly EditingInstanceListEntry[];
      itemContent?: (
        index: number,
        source: EditingInstanceListEntry,
        context: unknown,
      ) => ReactNode;
    }) => (
      <div>
        {props.data?.map((source, index) => (
          <React.Fragment key={source.id}>
            {props.itemContent?.(index, source, props.context)}
          </React.Fragment>
        ))}
      </div>
    ),
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

function audioPreview(
  streamIndex: number,
  processing: AudioTrackProcessing = { gainDb: 0 },
  previewRevision = 1,
) {
  return {
    mediaToken: 1,
    previewRevision,
    processing,
    streamIndex,
    url: `http://easytrim-media.localhost/source-1?variant=audio&stream=${streamIndex}&revision=${previewRevision}`,
  };
}

function installWaveformFetchMock() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const requestUrl =
        typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

      const width = Number(new URL(requestUrl).searchParams.get("width"));
      const buffer = new ArrayBuffer(12 + width * 4);
      const view = new DataView(buffer);
      view.setUint8(0, 0x45);
      view.setUint8(1, 0x54);
      view.setUint8(2, 0x57);
      view.setUint8(3, 0x46);
      view.setUint16(4, 2, true);
      view.setUint32(8, width, true);
      new Uint8Array(buffer, 12).fill(128);
      return { ok: true, arrayBuffer: async () => buffer } as Response;
    }),
  );
}

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
    currentTime: 0,
    resume: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    createAnalyser: vi.fn(() => ({
      fftSize: 0,
      connect: vi.fn(),
      disconnect: vi.fn(),
      getFloatTimeDomainData: vi.fn(),
    })),
    createChannelSplitter: vi.fn(() => ({
      connect: vi.fn(),
      disconnect: vi.fn(),
    })),
    createGain: vi.fn(() => ({
      gain: {
        value: 1,
        cancelScheduledValues: vi.fn(),
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
      },
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
  for (const instance of selectEditingInstances(store.getState())) {
    store.dispatch(editingInstanceClosed(instance.id));
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
  mocks.prepareAudioPreviews.mockImplementation(
    async (
      _sourcePath: string,
      audioTracks: Array<{
        processing: AudioTrackProcessing;
        streamIndex: number;
      }>,
    ) =>
      audioTracks.map(({ processing, streamIndex }, index) =>
        audioPreview(streamIndex, processing, index + 1),
      ),
  );
  mocks.prepareSourcePreview.mockResolvedValue({
    mediaToken: 1,
    url: "http://easytrim-media.localhost/source-1?variant=source",
    kind: "source",
  });
  mocks.prepareImportedSourceThumbnail.mockImplementation(async (sourcePath: string) => ({
    mediaToken: 9,
    url: `http://easytrim-media.localhost/9?variant=thumbnail&path=${encodeURIComponent(sourcePath)}`,
  }));
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
  it("keeps the editor visible without deprecated queue widgets", () => {
    render(<App />);
    expect(screen.getByRole("banner", { name: "Window title bar" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Export Queue" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Imported Sources" })).toBeInTheDocument();
  });

  it("opens the existing Command Palette from the centered title-bar search button", async () => {
    const user = userEvent.setup();
    render(<App />);

    const searchButton = await screen.findByRole("button", { name: "Search commands" });
    await user.click(searchButton);

    expect(screen.getByRole("dialog", { name: "Command Palette" })).toBeInTheDocument();
  });

  it("keeps the title-bar search trigger visible during a manual media recheck", async () => {
    const user = userEvent.setup();
    render(<App />);

    const searchButton = await screen.findByRole("button", { name: "Search commands" });
    await user.click(screen.getByRole("button", { name: "Media tools ready" }));
    await user.click(screen.getByRole("button", { name: "Recheck" }));

    expect(searchButton).toBeInTheDocument();
    await waitFor(() => expect(mocks.checkMediaCapabilities).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("button", { name: "Search commands" })).toBeInTheDocument();
  });

  it("opens, searches, and executes the shared file commands from the command palette", async () => {
    const user = userEvent.setup();
    render(<App />);

    fireEvent.keyDown(window, { key: "/", code: "Slash", shiftKey: true });
    expect(screen.getByRole("dialog", { name: "Command Palette" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Close File/ })).toHaveAttribute(
      "aria-disabled",
      "true",
    );

    const search = screen.getByRole("combobox", { name: "Search commands" });
    await user.type(search, "direc");
    expect(screen.getByRole("option", { name: /Open Folder/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Open File/ })).not.toBeInTheDocument();

    await user.clear(search);
    await user.type(search, "export");
    expect(screen.getByRole("option", { name: /Fast Export/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Optimized Export/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /GIF Export/ })).toBeInTheDocument();
    const audioExportOption = screen.getByRole("option", { name: /Audio Export/ });
    expect(audioExportOption.querySelector('[aria-label="Control+Shift+A"]')).not.toBeNull();

    await user.clear(search);
    await user.type(search, "folder");
    expect(
      screen.getByRole("option", { name: /Open Folder/ }).querySelector("mark"),
    ).toHaveTextContent("Folder");
    await user.keyboard("{Enter}");

    await waitFor(() => expect(mocks.chooseSource).toHaveBeenCalledExactlyOnceWith("folders"));
    expect(screen.queryByRole("dialog", { name: "Command Palette" })).not.toBeInTheDocument();

    getMenuTrigger("File").focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("menuitem", { name: /GIF Export/ })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /Audio Export/ })).toHaveTextContent("CtrlShiftA");
    await user.click(screen.getByRole("menuitem", { name: /Open Folder/ }));
    await waitFor(() => expect(mocks.chooseSource).toHaveBeenCalledTimes(2));
    expect(mocks.chooseSource).toHaveBeenLastCalledWith("folders");
  }, 10_000);

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
    fireEvent.keyDown(window, { key: "o", code: "KeyO", ctrlKey: true });
    await waitFor(() => expect(selectSourceSelection(store.getState())).toEqual(selection));
    await user.click(screen.getByRole("button", { name: "Loop playback" }));

    expect(screen.getByRole("button", { name: "Loop playback" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );

    fireEvent.keyDown(window, { key: "o", code: "KeyO", ctrlKey: true });
    await waitFor(() =>
      expect(
        screen.getByRole("checkbox", { name: replacementSelection.displayName }),
      ).toBeInTheDocument(),
    );
    await user.click(screen.getByRole("checkbox", { name: replacementSelection.displayName }));
    await waitFor(() =>
      expect(selectSourceSelection(store.getState())).toEqual(replacementSelection),
    );

    expect(screen.getByRole("button", { name: "Loop playback" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("starts with the editor in a no-source state", async () => {
    render(<App />);

    expect(screen.queryByText("Start a new clip")).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Source explorer" })).toBeInTheDocument();
    const shortcutList = screen.getByRole("list", { name: "Keyboard shortcuts" });
    expect(within(shortcutList).getAllByRole("listitem")).toHaveLength(7);
    for (const label of [
      "Open File",
      "Open Folder",
      "Play / Pause",
      "Prev / Next Frame",
      "Mark In / Mark Out",
      "Command Palette",
    ]) {
      expect(within(shortcutList).getByText(label)).toBeInTheDocument();
    }
    expect(within(shortcutList).getByLabelText("/")).toBeInTheDocument();
    expect(within(shortcutList).queryByText("Fast Export")).not.toBeInTheDocument();
    expect(within(shortcutList).queryByText("Optimize & Export")).not.toBeInTheDocument();
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
    expect(screen.getByRole("button", { name: "Loop playback" })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "Play selected segment" })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "Playback speed" })).not.toBeDisabled();
    expect(screen.getAllByText("00:00:00:00f").length).toBeGreaterThanOrEqual(8);
    expect(screen.queryByRole("slider", { name: "Playback position" })).toBeDisabled();
    expect(document.querySelector("[data-slot='timeline-pane']")).toHaveStyle({
      "--timeline-trim-center": "50%",
      "--timeline-trim-end": "100%",
      "--timeline-trim-end-inset": "0%",
      "--timeline-trim-start": "0%",
    });
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
      audio: { tracks: [], mergeAudio: false },
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
      audio: { tracks: [], mergeAudio: false },
    };

    const firstItem = {
      exportAttempts: [],
      id: "transition-a",
      origin: "source-import" as const,
      media,
      snapshot: firstSnapshot,
      sourceAvailability: "available" as const,
    };

    const replacementItem = {
      exportAttempts: [],
      id: "transition-b",
      origin: "source-import" as const,
      media: replacementMedia,
      snapshot: replacementSnapshot,
      sourceAvailability: "available" as const,
    };

    store.dispatch(editingInstancesAdded([firstItem, replacementItem]));
    store.dispatch(
      editingInstanceActivated({
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
    const user = userEvent.setup();
    render(<App />);

    await waitFor(() => expect(screen.getByRole("button", { name: "Play" })).not.toBeDisabled());
    const sourcePanel = document.getElementById("workspace-sidebar");
    const previewPanel = document.getElementById("editor-stage-preview");
    const timelinePanel = document.getElementById("editor-stage-timeline");
    const audioPanel = document.getElementById("editor-stage-audio");

    await user.click(screen.getByRole("checkbox", { name: replacementSelection.displayName }));

    expect(document.getElementById("workspace-sidebar")).toBe(sourcePanel);
    expect(document.getElementById("editor-stage-preview")).toBe(previewPanel);
    expect(document.getElementById("editor-stage-timeline")).toBe(timelinePanel);
    expect(document.getElementById("editor-stage-audio")).toBe(audioPanel);
    await waitFor(() =>
      expect(
        screen.getByRole("checkbox", { name: replacementSelection.displayName }),
      ).toHaveAttribute("data-active", "true"),
    );
    const selectedSegmentHeading = screen.getByRole("heading", { name: "Selected Segment" });
    expect(selectedSegmentHeading).toBeInTheDocument();
    expect(selectedSegmentHeading.closest(".select-none")).toBeNull();
    expect(screen.getByLabelText("Current playback time").closest(".select-none")).toBeNull();
    expect(screen.getByRole("heading", { name: /^Audio tracks/ })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByTestId("preview-loading-overlay")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Play" })).not.toBeDisabled();
    });
    expect(screen.getByRole("slider", { name: "Playback position" })).toHaveAttribute(
      "aria-valuenow",
      "1000000",
    );
  });

  it("waits for processed multi-track audio previews before playback", async () => {
    let resolveAudioPreviews!: (previews: ReturnType<typeof audioPreview>[]) => void;

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

      expect(screen.getByRole("button", { name: "Play" })).toBeDisabled();
      await waitFor(() =>
        expect(mocks.prepareWaveforms).toHaveBeenCalledWith(
          selection.sourcePath,
          expect.stringMatching(/^waveform-/),
          [1, 2],
          4_096,
          { 1: { gainDb: 0 }, 2: { gainDb: 0 } },
        ),
      );

      await act(async () => {
        resolveAudioPreviews([audioPreview(1), audioPreview(2)]);
      });
      await waitFor(() => expect(audioElements).toHaveLength(2));
      for (const audio of audioElements) fireEvent.canPlay(audio);
      await waitFor(() => expect(screen.getByRole("button", { name: "Play" })).toBeEnabled());
      await user.click(screen.getByRole("button", { name: "Play" }));

      expect(audioContext.resume).toHaveBeenCalledOnce();
      expect(play).toHaveBeenCalled();
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

  it("uses processed audio previews for multi-track playback", async () => {
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
    mocks.prepareAudioPreviews.mockResolvedValue([audioPreview(1), audioPreview(2)]);
    const { audioElements, mediaElementSources } = installAudioMocks(false);

    const user = userEvent.setup();

    try {
      render(<App />);
      await openSourcePicker(user);
      const video = (await screen.findByLabelText("Source video preview")) as HTMLVideoElement;
      await waitFor(() => expect(audioElements).toHaveLength(2));
      expect(mediaElementSources.some((source) => source.element === video)).toBe(false);
      expect(audioElements.map((audio) => audio.src)).toEqual(
        expect.arrayContaining([
          expect.stringContaining("stream=1&revision=1"),
          expect.stringContaining("stream=2&revision=1"),
        ]),
      );

      for (const audio of audioElements) fireEvent.canPlay(audio);
      await waitFor(() => expect(screen.getByRole("button", { name: "Play" })).toBeEnabled());
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("uses the processed preview for a single enabled non-default track", async () => {
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
        ...audioPreview(streamIndex),
      })),
    );
    const { audioElements, mediaElementSources } = installAudioMocks();
    const user = userEvent.setup();

    try {
      render(<App />);
      await openSourcePicker(user);
      const video = (await screen.findByLabelText("Source video preview")) as HTMLVideoElement;
      await waitFor(() => expect(audioElements).toHaveLength(3));
      expect(mediaElementSources.some((source) => source.element === video)).toBe(false);

      await user.click(screen.getByRole("button", { name: "Mute (eng)" }));
      await user.click(screen.getByRole("button", { name: "Mute (Game)" }));
      await waitFor(() =>
        expect(audioElements.some((audio) => audio.src.includes("stream=2&revision=1"))).toBe(true),
      );

      await user.click(screen.getByRole("button", { name: "Mute (Mic)" }));
      await user.click(screen.getByRole("button", { name: "Unmute (Game)" }));
      await waitFor(() =>
        expect(audioElements.some((audio) => audio.src.includes("stream=3&revision=1"))).toBe(true),
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("opens the source picker with Ctrl+O", () => {
    render(<App />);

    fireEvent.keyDown(window, { key: "щ", code: "KeyO", ctrlKey: true });

    expect(mocks.chooseSource).toHaveBeenCalledTimes(1);
  });

  it("opens the folder picker with Ctrl+K", () => {
    render(<App />);

    fireEvent.keyDown(window, { key: "k", code: "KeyK", ctrlKey: true });

    expect(mocks.chooseSource).toHaveBeenCalledWith("folders");
  });

  it("toggles the command palette with slash", () => {
    render(<App />);

    fireEvent.keyDown(window, { key: "/", code: "Slash", shiftKey: true });
    expect(screen.getByRole("dialog", { name: "Command Palette" })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "/", code: "Slash" });
    expect(screen.queryByRole("dialog", { name: "Command Palette" })).not.toBeInTheDocument();
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

    fireEvent.keyDown(window, { key: "q", code: "KeyQ", ctrlKey: true });

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
        "This deletes holiday.mp4 from your computer. This action can be undone",
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
    expect(screen.getByRole("heading", { name: "Explorer" })).toBeInTheDocument();
    expect(screen.getAllByText(selection.displayName)[0]).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Activity Feed" })).toBeInTheDocument();
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
    expect(audioPlayheadGrid).toHaveClass("grid-cols-(--editor-timeline-track-grid-columns)");
    expect(audioPlayhead?.parentElement).toHaveAttribute("data-slot", "audio-playhead-track");
    expect(screen.getByRole("button", { name: "Set segment start" })).toHaveAttribute(
      "aria-keyshortcuts",
      "I",
    );
    expect(screen.getByRole("button", { name: "Set segment end" })).toHaveAttribute(
      "aria-keyshortcuts",
      "O",
    );
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
    expect(videoTimelineRow).toHaveClass("grid-cols-(--editor-timeline-track-grid-columns)");
    const videoToolbar = within(videoTimelineRow as HTMLElement).getByRole("toolbar", {
      name: "Video timeline tools",
    });

    const timelineToolsTitle = screen.getByText("Tools");

    expect(timelineToolsTitle).toHaveAttribute("data-slot", "timeline-tools-title");
    expect(timelineToolsTitle.parentElement).toHaveClass(
      "grid-cols-(--editor-timeline-track-grid-columns)",
    );
    expect(videoToolbar).toHaveAttribute("data-slot", "timeline-toolbar");
    expect(videoToolbar).toHaveClass("flex", "items-stretch");
    for (const tool of within(videoToolbar).getAllByRole("button")) {
      expect(tool).toHaveAttribute("data-size", "icon-sm");
    }
    expect(within(videoToolbar).getByRole("button", { name: "Loop playback" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      within(videoToolbar)
        .getByRole("button", { name: "Loop playback" })
        .querySelector(".lucide-repeat"),
    ).not.toBeNull();
    expect(
      within(videoToolbar).getByRole("button", { name: "Play selected segment" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      within(videoToolbar)
        .getByRole("button", { name: "Play selected segment" })
        .querySelector(".lucide-between-vertical-start"),
    ).not.toBeNull();
    expect(within(videoToolbar).queryByRole("button", { name: "Reset tools" })).toBeNull();
    expect(
      videoToolbar.querySelector('[data-slot="timeline-tools-divider"]'),
    ).not.toBeInTheDocument();
    expect(within(videoToolbar).getAllByRole("button")).toHaveLength(3);
    const timelineFixedContent = screen.getByTestId("timeline-fixed-content");
    expect(
      within(timelineFixedContent).getByRole("button", { name: "Playback speed" }),
    ).toHaveAttribute("data-variant", "secondary");
    const playbackSpeedButton = within(timelineFixedContent).getByRole("button", {
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
    const sourcePanel = document.getElementById("workspace-sidebar");
    expect(sourcePanel).not.toBeNull();
    expect(document.getElementById("editor-stage-preview")).toContainElement(
      screen.getByLabelText("Source video preview"),
    );
    expect(document.getElementById("editor-stage-timeline")).toContainElement(
      screen.getByRole("heading", { name: "Selected Segment" }),
    );
    const fixedTimeline = screen.getByTestId("timeline-fixed-content");
    const audioTracksScroll = screen.getByTestId("audio-tracks-scroll");
    const timelinePanel = document.getElementById("editor-stage-timeline");
    expect(timelinePanel).not.toBeNull();
    expect(timelinePanel).toContainElement(fixedTimeline);
    expect(timelinePanel).toContainElement(audioTracksScroll);
    expect(fixedTimeline).toContainElement(
      screen.getByRole("heading", { name: "Selected Segment" }),
    );
    expect(fixedTimeline).not.toContainElement(
      screen.getByRole("heading", { name: /^Audio tracks/ }),
    );
    expect(timelinePanel).toContainElement(screen.getByRole("heading", { name: /^Audio tracks/ }));
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

  it("activates the first source when importing another batch", async () => {
    mocks.chooseSource
      .mockResolvedValueOnce([selection])
      .mockResolvedValueOnce([replacementSelection]);
    const user = userEvent.setup();
    render(<App />);

    await openSourcePicker(user);
    await waitForSourcePresence(true);
    const initiallyActiveId = selectActiveInstanceId(store.getState());

    await openSourcePicker(user);
    await waitFor(() => expect(selectEditingInstances(store.getState())).toHaveLength(2));
    await waitFor(() =>
      expect(mocks.inspectMedia).toHaveBeenCalledWith(replacementSelection.sourcePath),
    );

    const instances = selectEditingInstances(store.getState());
    expect(selectActiveInstanceId(store.getState())).not.toBe(initiallyActiveId);
    expect(selectActiveInstanceId(store.getState())).toBe(instances[1]?.id);
    expect(instances.map((instance) => instance.snapshot.source)).toEqual([
      selection,
      replacementSelection,
    ]);
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
    const video = (await screen.findByLabelText("Source video preview")) as HTMLVideoElement;
    const play = vi.spyOn(video, "play").mockResolvedValue();
    const startHandle = screen.getByRole("slider", { name: "Trim start" });
    video.currentTime = 10;
    fireEvent.timeUpdate(video);
    getMenuTrigger("File").focus();
    await user.keyboard("{Enter}");
    fireEvent.keyDown(window, { key: "i", code: "KeyI" });
    expect(startHandle).toHaveAttribute("aria-valuenow", "0");
    await user.click(screen.getByRole("menuitem", { name: /Optimized Export/ }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: " ", code: "Space" });
    expect(play).not.toHaveBeenCalled();

    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
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
    const mutedButton = await screen.findByRole("button", { name: "Unmute (eng)" });
    expect(mutedButton).toHaveAttribute("aria-pressed", "false");

    await user.click(mutedButton);
    expect(screen.getByRole("button", { name: "Mute (eng)" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("prepares aligned waveforms and keeps audio output choices in memory", async () => {
    installWaveformFetchMock();
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
    mocks.prepareAudioPreviews.mockResolvedValue([audioPreview(1), audioPreview(2)]);
    installAudioMocks();
    const user = userEvent.setup();

    try {
      render(<App />);
      await openSourcePicker(user);

      expect(await screen.findByRole("heading", { name: /^Audio tracks/ })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Mute (eng)" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      expect(screen.getByRole("button", { name: "Mute (Commentary)" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await user.click(screen.getByRole("button", { name: "Mute (eng)" }));
      expect(screen.getByRole("button", { name: "Unmute (eng)" })).toHaveAttribute(
        "aria-pressed",
        "false",
      );
      await user.click(screen.getByRole("button", { name: "Unmute (eng)" }));
      expect(screen.getByRole("button", { name: "Mute (eng)" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await waitFor(() =>
        expect(mocks.prepareWaveforms).toHaveBeenCalledWith(
          selection.sourcePath,
          expect.stringMatching(/^waveform-/),
          [1, 2],
          4_096,
          { 1: { gainDb: 0 }, 2: { gainDb: 0 } },
        ),
      );
      await waitFor(() =>
        expect(document.querySelectorAll("canvas[aria-hidden='true']")).toHaveLength(2),
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

      await user.click(screen.getByRole("button", { name: "Mute (Commentary)" }));
      const outputSummary = screen.getByText("1 selected track kept separately");
      expect(outputSummary).toBeInTheDocument();
      expect(outputSummary.closest(".select-none")).toBeNull();
      const mergeAudioLabel = screen.getByText("Merge selected tracks");
      expect(mergeAudioLabel.closest(".select-none")).toBeNull();
      const mergeAudio = screen.getByRole("checkbox", { name: "Merge selected tracks" });
      await user.hover(mergeAudio);
      expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
      expect(await screen.findByRole("tooltip")).toHaveTextContent(
        "All selected tracks are merged into one track; this requires encoding",
      );
      await user.click(mergeAudio);
      const mergedOutputSummary = screen.getByText("One selected track — no merge is needed");
      expect(mergedOutputSummary).toBeInTheDocument();
      expect(mergedOutputSummary.closest(".select-none")).toBeNull();
      expect(screen.getByRole("button", { name: "Mute (eng)" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      expect(screen.getByRole("button", { name: "Unmute (Commentary)" })).toHaveAttribute(
        "aria-pressed",
        "false",
      );
    } finally {
      bounds.mockRestore();
      vi.unstubAllGlobals();
    }
  }, 10_000);

  it("keeps tracks enabled when waveform preparation fails and retries per track", async () => {
    installWaveformFetchMock();
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
      expect(screen.getByRole("button", { name: "Mute (eng)" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await user.click(retry);
      await waitFor(() =>
        expect(document.querySelector("canvas[aria-hidden='true']")).not.toBeNull(),
      );
      expect(mocks.prepareWaveforms).toHaveBeenCalledTimes(2);
    } finally {
      bounds.mockRestore();
      vi.unstubAllGlobals();
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
    mocks.prepareAudioPreviews.mockResolvedValue([audioPreview(1), audioPreview(2)]);
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
      currentTime: 0,
      resume: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      createAnalyser: vi.fn(() => ({
        fftSize: 0,
        connect: vi.fn(),
        disconnect: vi.fn(),
        getFloatTimeDomainData: vi.fn(),
      })),
      createChannelSplitter: vi.fn(() => ({
        connect: vi.fn(),
        disconnect: vi.fn(),
      })),
      createGain: vi.fn(() => ({
        gain: {
          value: 1,
          cancelScheduledValues: vi.fn(),
          setValueAtTime: vi.fn(),
          linearRampToValueAtTime: vi.fn(),
        },
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

      expect(await screen.findByRole("alert")).toHaveTextContent("Playback could not start");
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
    mocks.prepareAudioPreviews.mockResolvedValue([audioPreview(1), audioPreview(2)]);
    const { audioConstructor, audioElements } = installAudioMocks();
    const user = userEvent.setup();

    try {
      render(<App />);
      await openSourcePicker(user);
      await screen.findByLabelText("Source video preview");
      await waitFor(() => expect(audioConstructor).toHaveBeenCalledTimes(2));

      fireEvent.error(screen.getByLabelText("Source video preview"));
      await screen.findByText("Compatible preview");
      await waitFor(() => expect(audioConstructor).toHaveBeenCalledTimes(6));

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

    const segmentToggle = screen.getByRole("button", { name: "Play selected segment" });
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

    const segmentToggle = screen.getByRole("button", { name: "Play selected segment" });
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

  it("keeps editor shortcuts locked during text entry", async () => {
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
    const inputKeyDown = vi.fn();
    input.addEventListener("keydown", inputKeyDown);
    play.mockClear();
    pause.mockClear();
    fireEvent.keyDown(input, { key: " ", code: "Space" });
    fireEvent.keyDown(input, { key: "ArrowRight", code: "ArrowRight" });
    fireEvent.keyDown(input, { key: "i", code: "KeyI" });
    fireEvent.keyDown(input, { key: "o", code: "KeyO" });
    expect(inputKeyDown).toHaveBeenCalledTimes(4);
    expect(play).not.toHaveBeenCalled();
    expect(pause).not.toHaveBeenCalled();
    expect(screen.getByRole("slider", { name: "Playback position" })).toHaveAttribute(
      "aria-valuenow",
      "0",
    );
    input.remove();
  });

  it("uses native 2x playback while the next-frame shortcut is held", async () => {
    mocks.chooseSource.mockResolvedValue([selection]);
    const user = userEvent.setup();
    render(<App />);

    await openSourcePicker(user);
    const video = (await screen.findByLabelText("Source video preview")) as HTMLVideoElement;
    const play = vi.spyOn(video, "play").mockResolvedValue();
    const pause = vi.spyOn(video, "pause").mockImplementation(() => undefined);
    const nextFrame = screen.getByRole("button", { name: "Next frame" });

    fireEvent.keyDown(window, { key: "ArrowRight", code: "ArrowRight" });
    expect(video.currentTime).toBeCloseTo(0.016683, 6);
    expect(play).not.toHaveBeenCalled();

    fireEvent.keyDown(window, { key: "ArrowRight", code: "ArrowRight", repeat: true });
    expect(video.playbackRate).toBe(2);
    expect(play).toHaveBeenCalledOnce();
    expect(nextFrame).toHaveAttribute("aria-pressed", "true");

    fireEvent.play(video);
    expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pause" })).not.toBeInTheDocument();
    video.currentTime = 2.5;
    fireEvent.keyUp(window, { key: "ArrowRight", code: "ArrowRight" });

    expect(pause).toHaveBeenCalled();
    expect(video.playbackRate).toBe(1);
    expect(nextFrame).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("slider", { name: "Playback position" })).toHaveAttribute(
      "aria-valuenow",
      "2500000",
    );
  });

  it("loops a forward frame shuttle from the source end when looping is enabled", async () => {
    mocks.chooseSource.mockResolvedValue([selection]);
    const user = userEvent.setup();
    render(<App />);

    await openSourcePicker(user);
    const video = (await screen.findByLabelText("Source video preview")) as HTMLVideoElement;
    const play = vi.spyOn(video, "play").mockResolvedValue();
    vi.spyOn(video, "pause").mockImplementation(() => undefined);

    expect(screen.getByRole("button", { name: "Loop playback" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    video.currentTime = 10;
    fireEvent.timeUpdate(video);
    fireEvent.keyDown(window, { key: "i", code: "KeyI" });
    video.currentTime = 20;
    fireEvent.timeUpdate(video);
    fireEvent.keyDown(window, { key: "o", code: "KeyO" });

    fireEvent.keyDown(window, { key: "ArrowRight", code: "ArrowRight" });
    fireEvent.keyDown(window, { key: "ArrowRight", code: "ArrowRight", repeat: true });
    fireEvent.play(video);

    video.currentTime = media.durationMicros / 1_000_000;
    fireEvent.ended(video);

    expect(video.currentTime).toBe(0);
    expect(screen.getByRole("slider", { name: "Playback position" })).toHaveAttribute(
      "aria-valuenow",
      "0",
    );
    await waitFor(() => expect(play).toHaveBeenCalledTimes(2));

    fireEvent.keyUp(window, { key: "ArrowRight", code: "ArrowRight" });
  });

  it("loops a reverse frame shuttle from the source start when looping is enabled", async () => {
    mocks.chooseSource.mockResolvedValue([selection]);
    const user = userEvent.setup();
    render(<App />);

    await openSourcePicker(user);
    const video = (await screen.findByLabelText("Source video preview")) as HTMLVideoElement;
    video.currentTime = 10;
    fireEvent.timeUpdate(video);
    fireEvent.keyDown(window, { key: "i", code: "KeyI" });
    video.currentTime = 20;
    fireEvent.timeUpdate(video);
    fireEvent.keyDown(window, { key: "o", code: "KeyO" });
    video.currentTime = 0.1;
    fireEvent.timeUpdate(video);

    const scheduledFrames: FrameRequestCallback[] = [];
    const requestFrame = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback) => scheduledFrames.push(callback));

    const cancelFrame = vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});

    try {
      fireEvent.keyDown(window, { key: "ArrowLeft", code: "ArrowLeft" });
      fireEvent.keyDown(window, { key: "ArrowLeft", code: "ArrowLeft", repeat: true });

      act(() => scheduledFrames.shift()?.(1_000));
      act(() => scheduledFrames.shift()?.(1_100));

      expect(screen.getByRole("slider", { name: "Playback position" })).toHaveAttribute(
        "aria-valuenow",
        `${media.durationMicros}`,
      );
      expect(video.currentTime).toBeCloseTo(media.durationMicros / 1_000_000, 6);

      fireEvent.keyUp(window, { key: "ArrowLeft", code: "ArrowLeft" });
      expect(cancelFrame).toHaveBeenCalled();
    } finally {
      requestFrame.mockRestore();
      cancelFrame.mockRestore();
    }
  });

  it("preserves queued frame steps when forward shuttle ends before the decoder settles", async () => {
    mocks.chooseSource.mockResolvedValue([selection]);
    const user = userEvent.setup();
    render(<App />);
    await openSourcePicker(user);
    const video = (await screen.findByLabelText("Source video preview")) as HTMLVideoElement;
    const play = vi.spyOn(video, "play").mockResolvedValue();
    vi.spyOn(video, "pause").mockImplementation(() => undefined);
    let position = 0;
    let seeking = false;
    Object.defineProperties(video, {
      currentTime: {
        configurable: true,
        get: () => position,
        set: (seconds: number) => {
          position = seconds;
          seeking = true;
        },
      },
      seeking: { configurable: true, get: () => seeking },
    });
    for (let step = 0; step < 3; step++) {
      fireEvent.keyDown(window, { key: "ArrowRight", code: "ArrowRight" });
      if (step < 2) fireEvent.keyUp(window, { key: "ArrowRight", code: "ArrowRight" });
    }
    const playhead = screen.getByRole("slider", { name: "Playback position" });
    expect(playhead).toHaveAttribute("aria-valuenow", "50049");
    expect(video.currentTime).toBeCloseTo(0.016683, 6);
    fireEvent.keyDown(window, { key: "ArrowRight", code: "ArrowRight", repeat: true });
    fireEvent.keyUp(window, { key: "ArrowRight", code: "ArrowRight" });
    expect(playhead).toHaveAttribute("aria-valuenow", "50049");
    seeking = false;
    fireEvent.seeked(video);
    expect(video.currentTime).toBeCloseTo(0.050049, 6);
    seeking = false;
    fireEvent.seeked(video);
    expect(play).not.toHaveBeenCalled();
    expect(playhead).toHaveAttribute("aria-valuenow", "50049");
  });

  it("uses a time-based coalesced seek while the previous-frame shortcut is held", async () => {
    mocks.chooseSource.mockResolvedValue([selection]);
    const user = userEvent.setup();
    render(<App />);

    await openSourcePicker(user);
    const video = (await screen.findByLabelText("Source video preview")) as HTMLVideoElement;
    const play = vi.spyOn(video, "play").mockResolvedValue();
    vi.spyOn(video, "pause").mockImplementation(() => undefined);
    video.currentTime = 10;
    fireEvent.timeUpdate(video);

    const scheduledFrames: FrameRequestCallback[] = [];
    const requestFrame = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback) => scheduledFrames.push(callback));

    const cancelFrame = vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});

    try {
      fireEvent.keyDown(window, { key: "ArrowLeft", code: "ArrowLeft" });
      fireEvent.keyDown(window, { key: "ArrowLeft", code: "ArrowLeft", repeat: true });

      expect(play).not.toHaveBeenCalled();
      expect(screen.getByRole("button", { name: "Previous frame" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      expect(scheduledFrames).toHaveLength(1);

      act(() => scheduledFrames.shift()?.(1_000));
      act(() => scheduledFrames.shift()?.(1_050));

      expect(screen.getByRole("slider", { name: "Playback position" })).toHaveAttribute(
        "aria-valuenow",
        "9883317",
      );
      expect(video.currentTime).toBeCloseTo(9.883317, 6);

      let mediaPosition = 10;
      Object.defineProperty(video, "currentTime", {
        configurable: true,
        get: () => mediaPosition,
        set: (seconds: number) => {
          mediaPosition = seconds;
        },
      });
      fireEvent.timeUpdate(video);

      expect(screen.getByRole("slider", { name: "Playback position" })).toHaveAttribute(
        "aria-valuenow",
        "9883317",
      );

      fireEvent.keyUp(window, { key: "ArrowLeft", code: "ArrowLeft" });
      expect(cancelFrame).toHaveBeenCalled();
      expect(screen.getByRole("button", { name: "Previous frame" })).toHaveAttribute(
        "aria-pressed",
        "false",
      );
    } finally {
      requestFrame.mockRestore();
      cancelFrame.mockRestore();
    }
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
      name: "Set segment start",
    });

    const setEnd = screen.getByRole("button", {
      name: "Set segment end",
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
    await user.click(screen.getByRole("button", { name: "Set segment end" }));
    expect(startHandle).toHaveAttribute("aria-valuenow", "0");
    expect(endHandle).toHaveAttribute("aria-valuenow", "15000000");

    video.currentTime = 65;
    fireEvent.timeUpdate(video);
    expect(screen.getByRole("button", { name: "Set segment start" })).toBeDisabled();
    video.currentTime = 0;
    fireEvent.timeUpdate(video);
    expect(screen.getByRole("button", { name: "Set segment end" })).toBeDisabled();
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
    const playhead = screen.getByRole("slider", { name: "Playback position" });

    expect(startHandle).toHaveAttribute("aria-valuenow", "0");
    expect(endHandle).toHaveAttribute("aria-valuenow", "65000000");

    startHandle.focus();
    await user.keyboard("{ArrowRight}");

    expect(startHandle).toHaveAttribute("aria-valuenow", "16683");
    expect(screen.getAllByText("00:00:00:01f")).not.toHaveLength(0);

    const playheadBeforeStep = Number(playhead.getAttribute("aria-valuenow"));
    playhead.focus();
    await user.keyboard("{ArrowRight}");
    expect(playhead).toHaveAttribute("aria-valuenow", `${playheadBeforeStep + 16683}`);
  });

  it("runs segment-boundary shortcuts while focus remains on timeline sliders", async () => {
    mocks.chooseSource.mockResolvedValue([selection]);
    const user = userEvent.setup();
    render(<App />);

    await openSourcePicker(user);
    const video = (await screen.findByLabelText("Source video preview")) as HTMLVideoElement;
    const startHandle = screen.getByRole("slider", { name: "Trim start" });
    const endHandle = screen.getByRole("slider", { name: "Trim end" });

    video.currentTime = 10;
    fireEvent.timeUpdate(video);
    startHandle.focus();
    fireEvent.keyDown(startHandle, { key: "i", code: "KeyI", repeat: true });
    expect(startHandle).toHaveAttribute("aria-valuenow", "0");
    fireEvent.keyDown(startHandle, { key: "i", code: "KeyI" });
    expect(startHandle).toHaveAttribute("aria-valuenow", "10000000");

    video.currentTime = 20;
    fireEvent.timeUpdate(video);
    endHandle.focus();
    fireEvent.keyDown(endHandle, { key: "o", code: "KeyO" });
    expect(endHandle).toHaveAttribute("aria-valuenow", "20000000");
  });

  it("keeps focus on a trim handle and toggles playback with Space after dragging", async () => {
    mocks.chooseSource.mockResolvedValue([selection]);
    const user = userEvent.setup();
    render(<App />);

    await openSourcePicker(user);
    const video = (await screen.findByLabelText("Source video preview")) as HTMLVideoElement;
    const play = vi.spyOn(video, "play").mockResolvedValue();
    const pause = vi.spyOn(video, "pause").mockImplementation(() => undefined);
    const trimStart = screen.getByRole("slider", { name: "Trim start" });

    trimStart.focus();
    fireEvent.pointerDown(trimStart, { clientX: 100, pointerId: 1 });
    fireEvent.pointerUp(trimStart, { clientX: 100, pointerId: 1 });

    expect(document.activeElement).toBe(trimStart);
    pause.mockClear();
    fireEvent.keyDown(trimStart, { key: " ", code: "Space" });
    expect(play).toHaveBeenCalledOnce();
    fireEvent.play(video);
    fireEvent.keyDown(trimStart, { key: " ", code: "Space", repeat: true });
    expect(pause).not.toHaveBeenCalled();
  });

  it("keeps focus on the segment handle and toggles playback with Space after dragging", async () => {
    mocks.chooseSource.mockResolvedValue([selection]);
    const user = userEvent.setup();
    render(<App />);

    await openSourcePicker(user);
    const video = (await screen.findByLabelText("Source video preview")) as HTMLVideoElement;
    const play = vi.spyOn(video, "play").mockResolvedValue();
    vi.spyOn(video, "pause").mockImplementation(() => undefined);
    const segmentHandle = screen.getByRole("slider", { name: "Move selected segment" });

    segmentHandle.focus();
    fireEvent.pointerDown(segmentHandle, { clientX: 100, pointerId: 1 });
    fireEvent.pointerUp(segmentHandle, { clientX: 100, pointerId: 1 });

    expect(document.activeElement).toBe(segmentHandle);
    fireEvent.keyDown(segmentHandle, { key: " ", code: "Space" });
    expect(play).toHaveBeenCalledOnce();
  });

  it("uses timeline shortcuts from focused playback controls", async () => {
    mocks.chooseSource.mockResolvedValue([selection]);
    const user = userEvent.setup();
    render(<App />);

    await openSourcePicker(user);
    const video = (await screen.findByLabelText("Source video preview")) as HTMLVideoElement;
    const play = vi.spyOn(video, "play").mockResolvedValue();
    vi.spyOn(video, "pause").mockImplementation(() => undefined);
    const playButton = screen.getByRole("button", { name: "Play" });

    playButton.focus();
    fireEvent.keyDown(playButton, { key: " ", code: "Space" });

    expect(play).toHaveBeenCalledOnce();
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

    await flushAnimationFrame();

    expect(document.querySelector("[data-slot='timeline-pane']")).toHaveStyle({
      "--timeline-trim-start": "25%",
    });

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
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
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

  it("snaps the segment center only while Shift is held", async () => {
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
      pointerId: 33,
    });
    fireEvent.pointerMove(segmentHandle, {
      clientX: clientXForSeconds(24.5),
      pointerId: 33,
    });
    await flushAnimationFrame();
    expect(segmentHandle).not.toHaveAttribute("data-snap-active");
    expect(screen.getByRole("slider", { name: "Trim start" })).toHaveAttribute(
      "aria-valuenow",
      "19500000",
    );

    fireEvent.pointerMove(segmentHandle, {
      clientX: clientXForSeconds(29.5),
      pointerId: 33,
      shiftKey: true,
    });
    await flushAnimationFrame();
    expect(segmentHandle).toHaveAttribute("data-snap-active", "true");
    expect(screen.getByRole("slider", { name: "Trim start" })).toHaveAttribute(
      "aria-valuenow",
      "25000000",
    );
    expect(screen.getByRole("slider", { name: "Trim end" })).toHaveAttribute(
      "aria-valuenow",
      "35000000",
    );

    fireEvent.pointerMove(segmentHandle, {
      clientX: clientXForSeconds(35.5),
      pointerId: 33,
      shiftKey: true,
    });
    await flushAnimationFrame();
    expect(segmentHandle).not.toHaveAttribute("data-snap-active");
    expect(screen.getByRole("slider", { name: "Trim start" })).toHaveAttribute(
      "aria-valuenow",
      "30500000",
    );
    fireEvent.pointerUp(segmentHandle, {
      clientX: clientXForSeconds(35.5),
      pointerId: 33,
      shiftKey: true,
    });
    expect(playhead).toHaveAttribute("aria-valuenow", "30000000");
  });

  it("uses Shift to snap the playhead and trim handles to reachable stable anchors", async () => {
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
      clientX: clientXForSeconds(9.5),
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
    expect(playhead).toHaveAttribute("aria-valuenow", "60000000");
    expect(video.currentTime).toBe(60);

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

  it("keeps scrub visuals current, throttles timecode renders, and releases with one exact seek", async () => {
    mocks.chooseSource.mockResolvedValue([selection]);
    const user = userEvent.setup();
    render(<App />);
    await openSourcePicker(user);
    const video = (await screen.findByLabelText("Source video preview")) as HTMLVideoElement;
    const timeline = screen.getByLabelText("Video trim timeline");
    vi.spyOn(timeline, "getBoundingClientRect").mockReturnValue({
      left: 0,
      width: 1000,
    } as DOMRect);
    let position = 0;
    const exactSeek = vi.fn((seconds: number) => {
      position = seconds;
    });

    const fastSeek = vi.fn((seconds: number) => {
      position = seconds;
    });

    Object.defineProperties(video, {
      currentTime: { configurable: true, get: () => position, set: exactSeek },
      fastSeek: { configurable: true, value: fastSeek },
    });
    const frames = new Map<number, FrameRequestCallback>();
    let frameId = 0;
    const request = vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      frames.set(++frameId, callback);
      return frameId;
    });

    const cancel = vi.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => {
      frames.delete(id);
    });

    const flush = (timestamp: number) =>
      act(() => {
        const pending = [...frames.values()];
        frames.clear();
        pending.forEach((callback) => callback(timestamp));
      });

    try {
      const playhead = screen.getByRole("slider", { name: "Playback position" });
      fireEvent.pointerDown(playhead, { clientX: 200, pointerId: 71 });
      flush(1000);
      const firstTimecode = screen.getByLabelText("Current playback time").textContent;
      fireEvent.pointerMove(playhead, { clientX: 400, pointerId: 71 });
      flush(1016);
      expect(playhead).toHaveAttribute("aria-valuenow", "26000000");
      expect(screen.getByLabelText("Current playback time").textContent).toBe(firstTimecode);
      fireEvent.pointerUp(playhead, { clientX: 600, pointerId: 71 });
      expect(fastSeek).toHaveBeenCalledTimes(2);
      expect(exactSeek).toHaveBeenCalledExactlyOnceWith(39);
      expect(playhead).toHaveAttribute("aria-valuenow", "39000000");
      expect(screen.getByLabelText("Current playback time").textContent).not.toBe(firstTimecode);
      flush(1032);
      expect(exactSeek).toHaveBeenCalledTimes(1);
    } finally {
      request.mockRestore();
      cancel.mockRestore();
    }
  });

  it("resumes playback only after the browser settles the final scrub seek", async () => {
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
    expect(playhead).toHaveAttribute("data-dragging", "true");
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
    expect(playhead).not.toHaveAttribute("data-dragging");
    expect(play).not.toHaveBeenCalled();
    expect(seekAssignments).toBe(1);
    expect(measureTimeline).toHaveBeenCalledOnce();

    seeking = false;
    fireEvent.seeked(video);
    expect(play).toHaveBeenCalledOnce();
  });

  it("coalesces long-video scrubs without seeking six audio tracks or accepting stale media time", async () => {
    const streams = Array.from({ length: 6 }, (_, index) => ({
      ...media.audioStreams[0]!,
      streamIndex: index + 1,
      isDefault: index === 0,
    }));

    mocks.chooseSource.mockResolvedValue([selection]);
    mocks.inspectMedia.mockResolvedValue({
      ...media,
      durationMicros: 14_400_000_000,
      audioStreams: streams,
    });
    mocks.prepareAudioPreviews.mockResolvedValue(
      streams.map(({ streamIndex }) => ({
        ...audioPreview(streamIndex),
      })),
    );
    const { audioElements } = installAudioMocks();
    const user = userEvent.setup();
    try {
      render(<App />);
      await openSourcePicker(user);
      const video = (await screen.findByLabelText("Source video preview")) as HTMLVideoElement;
      await waitFor(() => expect(audioElements).toHaveLength(6));
      for (const audio of audioElements) fireEvent.canPlay(audio);
      const audioSeeks = audioElements.map((audio) => vi.spyOn(audio, "currentTime", "set"));
      let position = 0;
      let seeking = false;
      const videoSeek = vi.fn((seconds: number) => {
        position = seconds;
        seeking = true;
      });

      Object.defineProperties(video, {
        currentTime: { configurable: true, get: () => position, set: videoSeek },
        seeking: { configurable: true, get: () => seeking },
      });
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
      await waitFor(() => expect(playhead).toBeEnabled());
      fireEvent.pointerDown(playhead, {
        button: 0,
        clientX: 100,
        isPrimary: true,
        pointerId: 9,
      });
      for (const clientX of [200, 600, 1000]) {
        fireEvent.pointerMove(playhead, { clientX, isPrimary: true, pointerId: 9 });
        await flushAnimationFrame();
        fireEvent.timeUpdate(video);
      }
      expect(videoSeek).toHaveBeenCalledOnce();
      expect(playhead).toHaveAttribute("aria-valuenow", "12960000000");
      for (const seek of audioSeeks) expect(seek).not.toHaveBeenCalled();
      fireEvent.pointerUp(playhead, { clientX: 1000, isPrimary: true, pointerId: 9 });
      seeking = false;
      fireEvent.seeked(video);
      expect(videoSeek).toHaveBeenCalledTimes(2);
      expect(videoSeek).toHaveBeenLastCalledWith(12_960);
      for (const seek of audioSeeks) expect(seek).not.toHaveBeenCalled();
      seeking = false;
      fireEvent.seeked(video);
      for (const seek of audioSeeks) {
        expect(seek).toHaveBeenCalledOnce();
        expect(seek).toHaveBeenLastCalledWith(12_960);
      }
    } finally {
      vi.unstubAllGlobals();
    }
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
      "The compatible preview could not be played",
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
      ffmpeg: { available: false, errorId: "notFound" },
      ffprobe: { available: false, errorId: "notFound" },
    });
    await store.dispatch(checkMediaCapabilitiesRequested());
    render(<App />);

    const status = await screen.findByRole("button", { name: "Media tools unavailable" });
    await userEvent.setup().click(status);

    expect(await screen.findByText(/FFprobe is not installed/)).toBeInTheDocument();
    expect(screen.getByText("winget install --id Gyan.FFmpeg --exact")).toBeInTheDocument();
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
        error: { code: "unsupported_media", messageId: "source.fileTypeIsNotSupportedYet" },
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

import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { preloadWorkspaceDialog } from "../app/layout/lib/workspace-view-loaders";
import { editingInstanceActivated } from "../app/store/actions/editing-instance-actions";
import { sourceCleared, sourceReady } from "../app/store/actions/source-actions";
import { startSourceMediaRuntime } from "../app/store/integration/source-media-runtime";
import {
  editingInstanceClosed,
  editingInstancesAdded,
  selectActiveInstanceId,
  selectEditingInstances,
} from "../app/store/slices/editing-instances-slice";
import { previewReady } from "../app/store/slices/preview-slice";
import { selectHasSource } from "../app/store/slices/source-slice";
import { store } from "../app/store/store";
import { checkMediaCapabilitiesRequested } from "../app/store/thunks/source-media-thunks";
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

beforeEach(() => {
  vi.clearAllMocks();
  store.dispatch(sourceCleared());
  for (const instance of selectEditingInstances(store.getState())) {
    store.dispatch(editingInstanceClosed(instance.id));
  }
  sourceDropListener = undefined;
  mocks.checkMediaCapabilities.mockResolvedValue(capabilities);
  mocks.chooseSource.mockResolvedValue([]);
  mocks.activateSourcePath.mockImplementation(async (sourcePath: string) =>
    sourcePath === replacementSelection.sourcePath ? replacementSelection : selection,
  );
  mocks.inspectMedia.mockResolvedValue(media);
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
  it("keeps the editor visible with the Export Queue only in the workspace toolbar", async () => {
    render(<App />);
    expect(screen.getByRole("banner", { name: "Window title bar" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Export Queue" })).toHaveLength(1);
    expect(
      await screen.findByRole("button", { name: /Imported Sources.*arrow keys to move it/ }),
    ).toBeInTheDocument();
  });

  it("focuses source search when Imported Sources opens from the View menu", async () => {
    // Hovering the menu item preloads the dialog, so its content mounts with the dialog.
    await preloadWorkspaceDialog("sources");
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole("button", { name: /Imported Sources.*arrow keys to move it/ });

    getMenuTrigger("View").focus();
    await user.keyboard("{Enter}");
    await user.click(screen.getByRole("menuitem", { name: "Imported Sources" }));

    const search = await screen.findByRole("searchbox", { name: "Search sources" });
    // The closed menu hands focus back on the next tick; it must not take it from the dialog.
    await act(() => new Promise((resolve) => setTimeout(resolve, 10)));
    expect(search).toHaveFocus();
  });

  it("opens the existing Command Palette from the centered title-bar search button", async () => {
    const user = userEvent.setup();
    render(<App />);

    const searchButton = await screen.findByRole("button", { name: "Search commands" });
    await user.click(searchButton);

    expect(await screen.findByRole("dialog", { name: "Command Palette" })).toBeInTheDocument();
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

  it("switches snapshots atomically while keeping every workspace panel mounted", async () => {
    const firstSnapshot: EditorSnapshot = {
      source: selection,
      trim: { startMicros: 0, endMicros: media.durationMicros },
      crop: null,
      audio: { tracks: [] },
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
      audio: { tracks: [] },
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
    const sourcePanel = document.getElementById("workspace-left-sidebar");
    const previewPanel = document.getElementById("editor-stage-preview");
    const timelinePanel = document.getElementById("editor-stage-timeline");
    const audioPanel = document.getElementById("editor-stage-audio");

    await user.click(
      await screen.findByRole("checkbox", { name: replacementSelection.displayName }),
    );

    expect(document.getElementById("workspace-left-sidebar")).toBe(sourcePanel);
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

    await waitFor(() => {
      expect(screen.queryByTestId("preview-loading-overlay")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Play" })).not.toBeDisabled();
    });
    expect(screen.getByRole("slider", { name: "Playhead position" })).toHaveAttribute(
      "aria-valuenow",
      "0",
    );
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
    expect(await screen.findByRole("dialog")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: " ", code: "Space" });
    expect(play).not.toHaveBeenCalled();

    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
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

  it("keeps editor shortcuts locked during text entry", async () => {
    mocks.chooseSource.mockResolvedValue([selection]);
    const user = userEvent.setup();
    render(<App />);

    await openSourcePicker(user);
    const video = (await screen.findByLabelText("Source video preview")) as HTMLVideoElement;
    const setPaused = (paused: boolean) =>
      Object.defineProperty(video, "paused", { configurable: true, value: paused });

    const play = vi.spyOn(video, "play").mockImplementation(async () => {
      setPaused(false);
    });

    const pause = vi.spyOn(video, "pause").mockImplementation(() => setPaused(true));

    // One 59.94 FPS frame forward: frame 1 starts at 16.683 ms.
    fireEvent.keyDown(window, { key: "ArrowRight", code: "ArrowRight" });
    expect(screen.getByRole("slider", { name: "Playhead position" })).toHaveAttribute(
      "aria-valuenow",
      "16683",
    );

    fireEvent.keyDown(window, { key: "ArrowLeft", code: "ArrowLeft" });
    expect(screen.getByRole("slider", { name: "Playhead position" })).toHaveAttribute(
      "aria-valuenow",
      "0",
    );

    fireEvent.keyDown(window, { key: " ", code: "Space" });
    fireEvent.seeked(video);
    await waitFor(() => expect(play).toHaveBeenCalledOnce());
    fireEvent.play(video);
    pause.mockClear();
    // Space pauses once the clock reaches the next frame boundary.
    fireEvent.keyDown(window, { key: " ", code: "Space" });
    Object.defineProperty(video, "currentTime", { configurable: true, value: 0.05 });
    await waitFor(() => expect(pause).toHaveBeenCalled());
    fireEvent.pause(video);

    const input = document.createElement("input");
    document.body.append(input);
    input.focus();
    const inputKeyDown = vi.fn();
    input.addEventListener("keydown", inputKeyDown);
    play.mockClear();
    pause.mockClear();
    const playhead = screen.getByRole("slider", { name: "Playhead position" });
    const lockedPosition = playhead.getAttribute("aria-valuenow");
    fireEvent.keyDown(input, { key: " ", code: "Space" });
    fireEvent.keyDown(input, { key: "ArrowRight", code: "ArrowRight" });
    fireEvent.keyDown(input, { key: "i", code: "KeyI" });
    fireEvent.keyDown(input, { key: "o", code: "KeyO" });
    expect(inputKeyDown).toHaveBeenCalledTimes(4);
    expect(play).not.toHaveBeenCalled();
    expect(pause).not.toHaveBeenCalled();
    expect(playhead).toHaveAttribute("aria-valuenow", lockedPosition);
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

import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { Provider } from "react-redux";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { ResizablePanelContextProvider } from "@/components/ui/resizable";
import { TooltipProvider } from "@/components/ui/tooltip";

import { COMMAND_PALETTE_SHORTCUT } from "@/app/commands/core/application-command.shortcuts";
import { getShortcutDisplayKeys } from "@/app/commands/core/application-command.utils";
import { ApplicationCommandsProvider } from "@/app/providers/ApplicationCommandsProvider";
import { sourceSelected } from "@/app/store/actions/source-actions";
import {
  previewFailed,
  previewLoading,
  previewReady,
  type PreviewState,
} from "@/app/store/slices/preview-slice";
import { selectSourceSelection } from "@/app/store/slices/source-slice";
import { type AppStore, createAppStore } from "@/app/store/store";
import { ChangelogProvider } from "@/features/changelog";
import { QueueDeleteSourceProvider } from "@/features/export";
import { PreviewTransformProvider } from "@/features/preview";
import { SourceDeleteProvider } from "@/features/source";

import { VideoPreviewEmpty } from "../components/VideoPreviewEmpty";
import { VideoPreview } from "../VideoPreview";

const playback = vi.hoisted(() => {
  const videoRef = { current: null as HTMLVideoElement | null };

  return {
    nativeLoopEnabled: false,
    onCanPlay: vi.fn(),
    onCropToolOpenChange: vi.fn(),
    onEnded: vi.fn(),
    onLoadedMetadata: vi.fn(),
    onPause: vi.fn(),
    onPlay: vi.fn(),
    onPreviewPlaybackError: vi.fn(),
    onTimeUpdate: vi.fn(),
    setMediaPlaybackRate: vi.fn(),
    setVideoElement: vi.fn((element: HTMLVideoElement | null) => {
      videoRef.current = element;
    }),
    toggle: vi.fn(),
    videoMuted: true,
    videoRef,
  };
});

vi.mock("@/app/hooks/usePlayback", () => ({
  usePlayback: () => playback,
}));
vi.mock("@/app/hooks/useAppUpdates", () => ({
  useAppUpdates: () => ({
    availableVersion: null,
    checkForUpdates: vi.fn(),
    installUpdate: vi.fn(),
    isInstalling: false,
    status: "idle",
  }),
}));

function readyPreview(url: string): Extract<PreviewState, { status: "ready" }> {
  return {
    status: "ready",
    value: { mediaToken: 1, url, kind: "proxy" },
  };
}

function TooltipTestProvider({ children, store }: { children: ReactNode; store: AppStore }) {
  return (
    <Provider store={store}>
      <TooltipProvider delayDuration={0}>
        <SourceDeleteProvider>
          <QueueDeleteSourceProvider>
            <PreviewTransformProvider>
              <ChangelogProvider>
                <ResizablePanelContextProvider>
                  <ApplicationCommandsProvider>{children}</ApplicationCommandsProvider>
                </ResizablePanelContextProvider>
              </ChangelogProvider>
            </PreviewTransformProvider>
          </QueueDeleteSourceProvider>
        </SourceDeleteProvider>
      </TooltipProvider>
    </Provider>
  );
}

function renderPreview(element: ReactElement, store = createAppStore()) {
  return render(element, {
    wrapper: ({ children }) => <TooltipTestProvider store={store}>{children}</TooltipTestProvider>,
  });
}

function setPreview(store: AppStore, preview: PreviewState) {
  if (preview.status === "ready") store.dispatch(previewReady({ preview: preview.value }));
  else if (preview.status === "loading") store.dispatch(previewLoading({ kind: preview.kind }));
  else if (preview.status === "failed") store.dispatch(previewFailed({ error: preview.error }));
}

function renderVideoPreview(preview: PreviewState, store = createAppStore()) {
  setPreview(store, preview);
  return renderPreview(<VideoPreview />, store);
}

function openTransformMenu(viewport: Element) {
  fireEvent.contextMenu(viewport);
}

function openCropTool(viewport: Element) {
  openTransformMenu(viewport);
  fireEvent.click(screen.getByRole("menuitem", { name: "Crop" }));
}

function selectTransformAction(viewport: Element, name: string) {
  openTransformMenu(viewport);
  fireEvent.click(screen.getByRole("menuitem", { name }));
}

beforeAll(() => {
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
});

afterAll(() => {
  vi.restoreAllMocks();
});

describe("VideoPreview", () => {
  it("keeps terminal preview failures inside the panel with a shared Skip action", () => {
    const store = createAppStore();
    store.dispatch(
      sourceSelected({
        loadToken: 1,
        source: { displayName: "first.mp4", sourcePath: "C:/Media/first.mp4" },
      }),
    );
    renderVideoPreview(
      {
        status: "failed",
        error: { code: "unsupported_media", message: "This source cannot be opened." },
      },
      store,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("This source cannot be opened.");
    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    expect(selectSourceSelection(store.getState())).toBeNull();
  });

  it("explains why a compatible proxy is used from the keyboard", () => {
    renderVideoPreview(readyPreview("easytrim-media://preview-1"));

    const badge = screen.getByText("Compatible preview");
    expect(badge).toHaveAttribute("tabindex", "0");
    fireEvent.focus(badge);

    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "The original source could not play directly, so EasyTrim prepared a compatible proxy that may use reduced quality. Exports still use the original file.",
    );
  });

  it("renders the empty preview when no source is loaded", () => {
    renderPreview(<VideoPreviewEmpty />);

    expect(screen.getByRole("region", { name: "Empty preview" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(6);
    expect(screen.getByText("Open File")).toBeInTheDocument();
    expect(screen.getByText("Open Folder")).toBeInTheDocument();
    expect(
      screen.getByLabelText(getShortcutDisplayKeys(COMMAND_PALETTE_SHORTCUT).join(" + ")),
    ).toBeInTheDocument();
    expect(screen.getByText("Support on Ko-fi.com")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /resize crop/i })).not.toBeInTheDocument();
  });

  it("shows the delayed crop hint and opens crop from the transform menu", () => {
    vi.useFakeTimers();
    try {
      const { container } = renderVideoPreview(readyPreview("easytrim-media://preview-1"));

      const viewport = container.querySelector("[data-preview-kind]")?.parentElement?.parentElement;
      expect(viewport).not.toBeNull();
      const affordance = container.querySelector("[data-crop-preview-affordance]");
      expect(affordance).toBeInTheDocument();
      expect(affordance).toHaveClass("group-focus-visible:opacity-100");

      fireEvent.pointerEnter(viewport!, { clientX: 30, clientY: 50 });
      expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
      act(() => vi.advanceTimersByTime(500));
      expect(screen.getByRole("tooltip")).toHaveStyle({ left: "42px", top: "62px" });

      openCropTool(viewport!);
      expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
      expect(container.querySelector("[data-crop-preview-affordance]")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps crop controls open after a drag and closes them outside the selection", () => {
    const { container } = renderVideoPreview(readyPreview("easytrim-media://preview-1"));

    const viewport = container.querySelector("[data-preview-kind]")?.parentElement?.parentElement;
    expect(viewport).not.toBeNull();
    expect(viewport).toHaveClass("overflow-hidden");
    expect(
      screen.queryByRole("button", { name: "Resize crop from top left" }),
    ).not.toBeInTheDocument();
    openCropTool(viewport!);
    expect(viewport).toHaveClass("overflow-hidden");
    const handle = screen.getByRole("button", { name: "Resize crop from top left" });
    expect(handle).toBeVisible();
    expect(screen.getAllByRole("button", { name: /resize crop from/i })).toHaveLength(8);
    expect(container.querySelector("[data-crop-rule-of-thirds]")).not.toBeInTheDocument();
    expect(container.querySelectorAll('[data-crop-snap-marker="top"]')).toHaveLength(5);
    expect(container.querySelectorAll('[data-crop-snap-marker="left"]')).toHaveLength(5);
    expect(container.querySelectorAll('[data-crop-snap-label="top"]')).toHaveLength(5);
    expect(container.querySelectorAll('[data-crop-snap-label="left"]')).toHaveLength(5);
    expect(container.querySelector('[data-crop-snap-marker="top"]')).toHaveClass("h-2");
    expect(container.querySelector('[data-crop-snap-marker="left"]')).toHaveClass("w-2");
    expect(container.querySelector("[data-crop-snap-markers]")).toHaveAttribute(
      "data-visible",
      "true",
    );
    expect(container.querySelector('[data-crop-snap-marker="top"]')).toHaveClass(
      "transition-[left,top]",
    );
    expect(container.querySelector("[data-preview-kind]")?.parentElement).toHaveClass(
      "transition-[width,height,left,top,transform]",
    );
    fireEvent.pointerDown(handle, { pointerId: 1, clientX: 0, clientY: 0 });
    expect(container.querySelector("[data-crop-rule-of-thirds]")?.parentElement).toHaveClass(
      "border-primary",
    );
    expect(container.querySelector('[data-crop-guide="vertical"]')).toBeInTheDocument();
    expect(container.querySelector('[data-crop-guide="horizontal"]')).toBeInTheDocument();
    expect(container.querySelector("[data-crop-rule-of-thirds]")).toHaveClass(
      "mix-blend-difference",
    );
    fireEvent.pointerUp(viewport!, { pointerId: 1, clientX: 0, clientY: 0 });
    expect(container.querySelector("[data-crop-rule-of-thirds]")).not.toBeInTheDocument();
    expect(handle).toBeVisible();

    fireEvent.click(viewport!);
    expect(container.querySelector("[data-crop-snap-markers]")).toHaveAttribute(
      "data-visible",
      "false",
    );
    expect(
      screen.queryByRole("button", { name: "Resize crop from top left" }),
    ).not.toBeInTheDocument();
  });

  it("scales the crop viewport into an even inset for markers", () => {
    const bounds = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockReturnValue(new DOMRect(0, 0, 400, 300));

    try {
      const { container } = renderVideoPreview(readyPreview("easytrim-media://preview-1"));

      const viewport = container.querySelector("[aria-label='Video crop preview']");
      const videoFrame = container.querySelector("[data-preview-kind]")?.parentElement;
      expect(viewport).not.toBeNull();
      expect(videoFrame).not.toBeNull();
      expect(videoFrame).toHaveStyle({ height: "225px", left: "0px", width: "400px" });

      openCropTool(viewport!);

      expect(videoFrame).toHaveStyle({
        height: "193.5px",
        left: "28px",
        top: "53.25px",
        width: "344px",
      });

      const videoFrameStyle = (videoFrame as HTMLElement).style;
      const left = Number.parseFloat(videoFrameStyle.left);
      const top = Number.parseFloat(videoFrameStyle.top);
      const width = Number.parseFloat(videoFrameStyle.width);
      const height = Number.parseFloat(videoFrameStyle.height);

      expect(left).toBeCloseTo(400 - left - width);
      expect(top).toBeCloseTo(300 - top - height);
      expect(left).toBeGreaterThanOrEqual(28);
      expect(top).toBeGreaterThanOrEqual(28);
      expect(container.querySelector('[data-crop-snap-marker="top"]')).toHaveStyle({
        top: "41.25px",
      });
      expect(container.querySelector('[data-crop-snap-marker="left"]')).toHaveStyle({
        left: "16px",
      });
    } finally {
      bounds.mockRestore();
    }
  });

  it("pauses playback while crop controls are open", () => {
    const { container } = renderVideoPreview(readyPreview("easytrim-media://preview-1"));

    const viewport = container.querySelector("[data-preview-kind]")?.parentElement?.parentElement;
    const video = container.querySelector("video");
    expect(viewport).not.toBeNull();
    expect(video).not.toBeNull();
    const pause = vi.spyOn(video!, "pause").mockImplementation(() => undefined);
    pause.mockClear();

    openCropTool(viewport!);
    expect(pause).toHaveBeenCalledTimes(1);

    fireEvent.play(video!);
    expect(pause).toHaveBeenCalledTimes(2);
  });

  it("shows the transform menu and applies rotation to the CSS preview", () => {
    const store = createAppStore();
    const { container } = renderVideoPreview(readyPreview("easytrim-media://preview-1"), store);

    const viewport = container.querySelector("[aria-label='Video crop preview']");
    openTransformMenu(viewport!);
    expect(screen.getByRole("menu")).toHaveTextContent(
      "CropRotate 90 CWRotate 90 CCWRotate 180Flip horizontallyFlip verticallyReset",
    );
    expect(screen.getAllByRole("separator")).toHaveLength(3);

    fireEvent.click(screen.getByRole("menuitem", { name: "Rotate 90 CW" }));
    expect(store.getState().crop.rotationDegrees).toBe(90);
    expect(container.querySelector("video")).toHaveStyle({ transform: "rotate(90deg)" });

    selectTransformAction(viewport!, "Rotate 90 CW");
    selectTransformAction(viewport!, "Rotate 90 CW");
    expect(store.getState().crop.rotationDegrees).toBe(270);

    selectTransformAction(viewport!, "Rotate 90 CW");
    expect(store.getState().crop.rotationDegrees).toBe(0);
    expect(container.querySelector("video")).toHaveStyle({ transform: "rotate(360deg)" });

    selectTransformAction(viewport!, "Rotate 90 CCW");
    expect(store.getState().crop.rotationDegrees).toBe(270);
    expect(container.querySelector("video")).toHaveStyle({ transform: "rotate(270deg)" });

    selectTransformAction(viewport!, "Rotate 180");
    expect(store.getState().crop.rotationDegrees).toBe(90);
    expect(container.querySelector("video")).toHaveStyle({ transform: "rotate(450deg)" });
  });

  it("applies flips to the preview and keeps a full-turn equivalent in UI state", () => {
    const store = createAppStore();
    const { container } = renderVideoPreview(readyPreview("easytrim-media://preview-1"), store);

    const viewport = container.querySelector("[aria-label='Video crop preview']")!;
    selectTransformAction(viewport, "Flip horizontally");
    expect(store.getState().crop.flipHorizontal).toBe(true);
    expect(container.querySelector("video")).toHaveStyle({ transform: "rotate(0deg) scaleX(-1)" });

    selectTransformAction(viewport, "Flip vertically");
    expect(store.getState().crop.flipVertical).toBe(true);
    expect(container.querySelector("video")).toHaveStyle({
      transform: "rotate(0deg) scaleX(-1) scaleY(-1)",
    });

    selectTransformAction(viewport, "Rotate 180");
    expect(store.getState().crop).toMatchObject({
      flipHorizontal: true,
      flipVertical: true,
      rotationDegrees: 180,
    });
    expect(container.querySelector("video")).toHaveStyle({
      transform: "rotate(180deg) scaleX(-1) scaleY(-1)",
    });
  });

  it("confirms before resetting preview transformations", () => {
    const store = createAppStore();
    const { container } = renderVideoPreview(readyPreview("easytrim-media://preview-1"), store);

    const viewport = container.querySelector("[aria-label='Video crop preview']")!;
    selectTransformAction(viewport, "Flip horizontally");
    selectTransformAction(viewport, "Rotate 180");
    selectTransformAction(viewport, "Flip vertically");
    selectTransformAction(viewport, "Reset");

    expect(screen.getByRole("alertdialog")).toHaveTextContent("Reset video transformations?");
    expect(store.getState().crop).toMatchObject({
      flipHorizontal: true,
      flipVertical: true,
      rotationDegrees: 180,
    });

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));

    expect(store.getState().crop).toMatchObject({
      flipHorizontal: false,
      flipVertical: false,
      rotationDegrees: 0,
      value: { x: 0, y: 0, width: 1, height: 1 },
    });
  });

  it("toggles playback on a left click and supports the context menu", () => {
    playback.toggle.mockClear();
    const { container } = renderVideoPreview(readyPreview("easytrim-media://preview-1"));

    const viewport = container.querySelector("[aria-label='Video crop preview']");
    expect(viewport).not.toBeNull();

    fireEvent.click(viewport!);
    expect(playback.toggle).toHaveBeenCalledWith({
      type: "button",
      id: "preview.click",
    });
    expect(
      screen.queryByRole("button", { name: "Resize crop from top left" }),
    ).not.toBeInTheDocument();

    openCropTool(viewport!);
    expect(screen.getByRole("button", { name: "Resize crop from top left" })).toBeVisible();
  });

  it("closes crop controls with Escape or when focus leaves the preview", () => {
    const { container } = renderVideoPreview(readyPreview("easytrim-media://preview-1"));

    const viewport = container.querySelector("[data-preview-kind]")?.parentElement?.parentElement;
    expect(viewport).not.toBeNull();

    openCropTool(viewport!);
    fireEvent.keyDown(viewport!, { key: "Escape" });
    expect(
      screen.queryByRole("button", { name: "Resize crop from top left" }),
    ).not.toBeInTheDocument();

    openCropTool(viewport!);
    fireEvent.blur(viewport!, { relatedTarget: document.body });
    expect(
      screen.queryByRole("button", { name: "Resize crop from top left" }),
    ).not.toBeInTheDocument();
  });

  it("keeps native audio muted when the preview element is replaced", () => {
    const store = createAppStore();
    const { container } = renderVideoPreview(readyPreview("easytrim-media://preview-1"), store);

    const firstVideo = container.querySelector("video");
    const firstVideoPause = vi.spyOn(firstVideo!, "pause").mockImplementation(() => undefined);
    expect(firstVideo).toHaveProperty("muted", true);
    expect(firstVideo).toHaveAttribute("crossorigin", "anonymous");

    act(() => {
      store.dispatch(
        previewReady({
          preview: readyPreview("easytrim-media://preview-2").value,
        }),
      );
    });
    const replacementVideo = container.querySelector("video");
    expect(replacementVideo).not.toBe(firstVideo);
    expect(firstVideoPause).toHaveBeenCalled();
    expect(replacementVideo).toHaveProperty("muted", true);
    expect(replacementVideo).toHaveAttribute("crossorigin", "anonymous");
  });
});

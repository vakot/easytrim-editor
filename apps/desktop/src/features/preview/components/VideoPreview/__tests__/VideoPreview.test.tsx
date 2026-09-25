import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  waitForElementToBeRemoved,
} from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { Provider } from "react-redux";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { ResizablePanelContextProvider } from "@/components/ui/resizable";
import { TooltipProvider } from "@/components/ui/tooltip";

import { COMMAND_PALETTE_SHORTCUT } from "@/app/commands/core/application-command.shortcuts";
import { getShortcutDisplayKeys } from "@/app/commands/core/application-command.utils";
import { ApplicationCommandsProvider } from "@/app/providers/ApplicationCommandsProvider";
import { sourceReady, sourceSelected } from "@/app/store/actions/source-actions";
import { cropChanged, flipToggled, rotationChanged } from "@/app/store/slices/crop-slice";
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
import { firstSource, media } from "@/test/source.fixtures";

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
  if (preview.status === "ready" && store.getState().source.media === null) {
    store.dispatch(
      sourceReady({
        loadToken: store.getState().source.loadToken,
        media: media(firstSource.sourcePath),
      }),
    );
  }
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

  it("waits for source dimensions instead of inventing preview geometry", () => {
    const store = createAppStore();
    setPreview(store, readyPreview("easytrim-media://preview-1"));
    const { container } = renderPreview(<VideoPreview />, store);

    expect(container.querySelector("[data-preview-frame]")).not.toBeInTheDocument();
    expect(container.querySelector("video")).not.toBeInTheDocument();
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

      const viewport = container.querySelector('[aria-label="Video crop preview"]');
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
      expect(container.querySelector("[data-crop-preview-affordance]")).toHaveStyle({
        opacity: "0",
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps crop controls open after a drag and closes them outside the selection", async () => {
    const { container } = renderVideoPreview(readyPreview("easytrim-media://preview-1"));

    const viewport = container.querySelector('[aria-label="Video crop preview"]');
    expect(viewport).not.toBeNull();
    expect(viewport).not.toHaveClass("overflow-hidden");
    expect(container.querySelector("[data-crop-clip]")).toHaveClass("overflow-hidden");
    expect(
      screen.queryByRole("button", { name: "Resize crop from top left" }),
    ).not.toBeInTheDocument();
    openCropTool(viewport!);
    expect(container.querySelector("[data-crop-clip]")).toHaveClass("overflow-hidden");
    const handle = screen.getByRole("button", { name: "Resize crop from top left" });
    await waitFor(() => expect(handle).toBeVisible());
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
    expect(container.querySelector('[data-crop-snap-marker="top"]')).toHaveStyle({
      left: "0%",
    });
    const frameBounds = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockReturnValue(new DOMRect(0, 0, 400, 300));

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
    frameBounds.mockRestore();
    expect(container.querySelector("[data-crop-snap-markers]")).toHaveAttribute(
      "data-visible",
      "false",
    );
    await waitForElementToBeRemoved(() =>
      screen.queryByRole("button", { name: "Resize crop from top left" }),
    );
    expect(
      screen.queryByRole("button", { name: "Resize crop from top left" }),
    ).not.toBeInTheDocument();
  });

  it("contains with CSS and edits crop over the complete rotated source", async () => {
    const { container } = renderVideoPreview(readyPreview("easytrim-media://preview-1"));

    const viewport = container.querySelector('[aria-label="Video crop preview"]')!;
    const frame = container.querySelector("[data-preview-frame]")!;
    expect(frame).toHaveAttribute("data-aspect-ratio", "1.7777777777777777");
    expect(frame).toHaveClass("data-[crop-editing=false]:w-(--preview-normal-width)");
    expect(
      (container.querySelector("[data-preview-area]") as HTMLElement).style.getPropertyValue(
        "--preview-normal-width",
      ),
    ).toMatch(/^min\(100cqw, /);
    expect(container.querySelector("[data-crop-clip]")).toBeInTheDocument();
    expect(container.querySelector("[data-full-rotated-source]")).toHaveAttribute(
      "data-source-geometry",
      "crop-relative-source",
    );

    openCropTool(viewport);

    expect(frame).toHaveAttribute("data-crop-editing", "true");
    expect(
      (container.querySelector("[data-preview-area]") as HTMLElement).style.getPropertyValue(
        "--preview-crop-width",
      ),
    ).toMatch(/^min\(max\(0px, calc\(100cqw - 56px\)\)/);
    expect(frame).toHaveAttribute("data-aspect-ratio", "1.7777777777777777");
    expect(container.querySelector("[data-full-rotated-source]")).toHaveAttribute(
      "data-source-geometry",
      "full-rotated-source",
    );
    expect(container.querySelector("[data-crop-selection]")).toBeInTheDocument();
  });

  it("converts crop drag deltas using the target full-source coordinate frame", () => {
    const store = createAppStore();
    store.dispatch(sourceSelected({ loadToken: 1, source: firstSource }));
    store.dispatch(sourceReady({ loadToken: 1, media: media(firstSource.sourcePath) }));
    store.dispatch(
      cropChanged({
        crop: { x: 0.1, y: 0.1, width: 0.5, height: 0.5 },
        resolution: { width: 960, height: 540 },
      }),
    );
    const { container } = renderVideoPreview(readyPreview("easytrim-media://preview-1"), store);
    const viewport = container.querySelector('[aria-label="Video crop preview"]')!;
    openCropTool(viewport);
    const selection = container.querySelector("[data-crop-selection]")!;
    const frameBounds = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockReturnValue(new DOMRect(0, 0, 400, 200));

    fireEvent.pointerDown(selection, { pointerId: 1, clientX: 100, clientY: 50 });
    fireEvent.pointerMove(viewport, { pointerId: 1, clientX: 140, clientY: 70 });
    fireEvent.pointerUp(viewport, { pointerId: 1, clientX: 140, clientY: 70 });

    expect(store.getState().crop.value?.x).toBeCloseTo(0.25625);
    expect(store.getState().crop.value?.y).toBeCloseTo(0.23889);
    expect(store.getState().crop.value).toMatchObject({ width: 0.5, height: 0.5 });
    frameBounds.mockRestore();
  });

  it("converts crop drag deltas from the flipped visual space to crop coordinates", () => {
    const store = createAppStore();
    store.dispatch(sourceSelected({ loadToken: 1, source: firstSource }));
    store.dispatch(sourceReady({ loadToken: 1, media: media(firstSource.sourcePath) }));
    store.dispatch(
      cropChanged({
        crop: { x: 0.3, y: 0.3, width: 0.5, height: 0.5 },
        resolution: { width: 960, height: 540 },
      }),
    );
    store.dispatch(flipToggled("horizontal"));
    store.dispatch(flipToggled("vertical"));
    const { container } = renderVideoPreview(readyPreview("easytrim-media://preview-1"), store);
    const viewport = container.querySelector('[aria-label="Video crop preview"]')!;
    openCropTool(viewport);
    const selection = container.querySelector("[data-crop-selection]")!;
    const frameBounds = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockReturnValue(new DOMRect(0, 0, 400, 200));

    fireEvent.pointerDown(selection, { pointerId: 1, clientX: 100, clientY: 50 });
    fireEvent.pointerMove(viewport, { pointerId: 1, clientX: 140, clientY: 70 });
    fireEvent.pointerUp(viewport, { pointerId: 1, clientX: 140, clientY: 70 });

    expect(store.getState().crop.value?.x).toBeCloseTo(0.14375);
    expect(store.getState().crop.value?.y).toBeCloseTo(0.16111);
    expect(store.getState().crop.value).toMatchObject({ width: 0.5, height: 0.5 });
    frameBounds.mockRestore();
  });

  it("uses target frame bounds to map crop dragging during a frame morph", () => {
    const store = createAppStore();
    store.dispatch(
      cropChanged({
        crop: { x: 0.25, y: 0.1, width: 0.5, height: 0.6 },
        resolution: { width: 960, height: 648 },
      }),
    );
    const { container } = renderVideoPreview(readyPreview("easytrim-media://preview-1"), store);
    const viewport = container.querySelector('[aria-label="Video crop preview"]') as HTMLElement;
    vi.spyOn(viewport, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 800, 600));

    openCropTool(viewport);

    const selection = container.querySelector("[data-crop-selection]")!;
    fireEvent.pointerDown(selection, { pointerId: 1, clientX: 100, clientY: 100 });

    fireEvent.pointerMove(viewport, { pointerId: 1, clientX: 174.4, clientY: 141.85 });

    expect(store.getState().crop.value).toEqual({
      x: 0.35,
      y: 0.2,
      width: 0.5,
      height: 0.6,
    });
  });

  it("moves the crop selection from the visible crop to its source rect with the video", () => {
    const store = createAppStore();
    store.dispatch(
      cropChanged({
        crop: { x: 0.25, y: 0.1, width: 0.5, height: 0.6 },
        resolution: { width: 960, height: 648 },
      }),
    );
    const { container } = renderVideoPreview(readyPreview("easytrim-media://preview-1"), store);
    const viewport = container.querySelector('[aria-label="Video crop preview"]')!;

    openCropTool(viewport);

    const selection = container.querySelector("[data-crop-selection]");
    const rotatingOutput = container.querySelector("[data-rotating-output]");
    expect(selection).toHaveStyle({
      left: "0%",
      top: "0%",
      width: "100%",
      height: "100%",
      opacity: "0",
    });
    expect(selection).toHaveAttribute("data-source-crop-x", "0.25");
    expect(selection).toHaveAttribute("data-source-crop-y", "0.1");
    expect(selection).toHaveAttribute("data-source-crop-width", "0.5");
    expect(selection).toHaveAttribute("data-source-crop-height", "0.6");
    expect(rotatingOutput).toContainElement(container.querySelector("[data-crop-clip]"));
    expect(rotatingOutput).toContainElement(
      container.querySelector("[data-crop-selection-coordinate-space]"),
    );
    expect(container.querySelector('[aria-label="Video crop preview"]')).toHaveStyle({
      "--preview-transition-duration": "300ms",
    });
    expect(container.querySelector("[data-crop-preview-affordance]")).toHaveClass(
      "duration-(--preview-transition-duration)",
    );
    expect(container.querySelector("[data-crop-snap-markers]")).toHaveAttribute(
      "data-visible",
      "true",
    );
    expect(container.querySelector("[data-crop-selection-coordinate-space]")).toContainElement(
      container.querySelector("[data-crop-selection]"),
    );
  });

  it("passes final crop-safe geometry as the frame target", () => {
    const { container } = renderVideoPreview(readyPreview("easytrim-media://preview-1"));
    const viewport = container.querySelector('[aria-label="Video crop preview"]')!;
    vi.spyOn(viewport, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 800, 600));

    openCropTool(viewport);

    const frame = container.querySelector("[data-preview-frame]")!;
    expect(frame).toHaveAttribute("data-crop-editing", "true");
    expect(container.querySelector("[data-preview-area]")).toHaveStyle({
      "--preview-crop-width": `min(max(0px, calc(100cqw - 56px)), max(0px, calc(${(16 / 9) * 100}cqh - ${(16 / 9) * 56}px)))`,
    });
    expect(frame).not.toHaveStyle({ width: "400px", height: "225px" });
  });

  it("pauses playback while crop controls are open", () => {
    const { container } = renderVideoPreview(readyPreview("easytrim-media://preview-1"));

    const viewport = container.querySelector('[aria-label="Video crop preview"]');
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

    const viewport = container.querySelector('[aria-label="Video crop preview"]');
    openTransformMenu(viewport!);
    expect(screen.getByRole("menu")).toHaveTextContent(
      "CropRotate 90 CWRotate 90 CCWRotate 180Flip horizontallyFlip verticallyReset",
    );
    expect(screen.getAllByRole("separator")).toHaveLength(3);

    fireEvent.click(screen.getByRole("menuitem", { name: "Rotate 90 CW" }));
    expect(store.getState().crop.rotationDegrees).toBe(90);
    expect(container.querySelector("video")).toHaveAttribute("data-presentation-rotation", "90");
    expect(container.querySelector("[data-flip-layer]")).toContainElement(
      container.querySelector("[data-rotating-output]"),
    );
    expect(container.querySelector("[data-rotating-output]")).toContainElement(
      container.querySelector("[data-crop-mask]"),
    );
    expect(container.querySelector("[data-preview-frame]")).toHaveClass("overflow-visible");

    selectTransformAction(viewport!, "Rotate 90 CW");
    selectTransformAction(viewport!, "Rotate 90 CW");
    expect(store.getState().crop.rotationDegrees).toBe(270);

    selectTransformAction(viewport!, "Rotate 90 CW");
    expect(store.getState().crop.rotationDegrees).toBe(0);
    expect(container.querySelector("video")).toHaveAttribute("data-presentation-rotation", "360");

    selectTransformAction(viewport!, "Rotate 90 CCW");
    expect(store.getState().crop.rotationDegrees).toBe(270);
    expect(container.querySelector("video")).toHaveAttribute("data-presentation-rotation", "270");

    selectTransformAction(viewport!, "Rotate 180");
    expect(store.getState().crop.rotationDegrees).toBe(90);
    expect(container.querySelector("video")).toHaveAttribute("data-presentation-rotation", "450");
  });

  it("applies flips to the preview and keeps a full-turn equivalent in UI state", () => {
    const store = createAppStore();
    const { container } = renderVideoPreview(readyPreview("easytrim-media://preview-1"), store);

    const viewport = container.querySelector('[aria-label="Video crop preview"]')!;
    selectTransformAction(viewport, "Flip horizontally");
    expect(store.getState().crop.flipHorizontal).toBe(true);
    expect(container.querySelector("[data-flip-layer]")).toHaveAttribute(
      "data-flip-horizontal",
      "true",
    );
    expect(container.querySelector("[data-flip-layer]")).toHaveAttribute(
      "data-flip-vertical",
      "false",
    );

    selectTransformAction(viewport, "Flip vertically");
    expect(store.getState().crop.flipVertical).toBe(true);
    expect(container.querySelector("[data-flip-layer]")).toHaveAttribute(
      "data-flip-vertical",
      "true",
    );

    selectTransformAction(viewport, "Rotate 180");
    expect(store.getState().crop).toMatchObject({
      flipHorizontal: true,
      flipVertical: true,
      rotationDegrees: 180,
    });
    expect(container.querySelector("[data-flip-layer]")).toHaveAttribute(
      "data-flip-horizontal",
      "true",
    );
    expect(container.querySelector("[data-flip-layer]")).toHaveAttribute(
      "data-flip-vertical",
      "true",
    );
  });

  it.each([
    ["no flips", false, false, "Rotate 90 CW", 90, 90],
    ["horizontal flip", true, false, "Rotate 90 CW", 270, -90],
    ["vertical flip", false, true, "Rotate 90 CW", 270, -90],
    ["both flips", true, true, "Rotate 90 CW", 90, 90],
    ["no flips", false, false, "Rotate 90 CCW", 270, -90],
    ["horizontal flip", true, false, "Rotate 90 CCW", 90, 90],
    ["vertical flip", false, true, "Rotate 90 CCW", 90, 90],
    ["both flips", true, true, "Rotate 90 CCW", 270, -90],
  ] as const)(
    "%s flip configuration uses its visual-coordinate command delta",
    (_name, horizontal, vertical, action, expectedRotation, expectedAngle) => {
      const store = createAppStore();
      if (horizontal) store.dispatch(flipToggled("horizontal"));
      if (vertical) store.dispatch(flipToggled("vertical"));
      const { container } = renderVideoPreview(readyPreview("easytrim-media://preview-1"), store);
      const viewport = container.querySelector('[aria-label="Video crop preview"]')!;
      const rotation = container.querySelector("[data-output-rotation]");

      selectTransformAction(viewport, action);
      expect(store.getState().crop.rotationDegrees).toBe(expectedRotation);
      expect(rotation).toHaveAttribute("data-output-rotation", String(expectedAngle));
    },
  );

  it.each([
    ["no flips", false, false],
    ["horizontal flip", true, false],
    ["vertical flip", false, true],
    ["both flips", true, true],
  ] as const)("keeps Rotate 180 unchanged with %s", (_name, horizontal, vertical) => {
    const store = createAppStore();
    if (horizontal) store.dispatch(flipToggled("horizontal"));
    if (vertical) store.dispatch(flipToggled("vertical"));
    const { container } = renderVideoPreview(readyPreview("easytrim-media://preview-1"), store);
    const viewport = container.querySelector('[aria-label="Video crop preview"]')!;

    selectTransformAction(viewport, "Rotate 180");

    expect(store.getState().crop.rotationDegrees).toBe(180);
    expect(container.querySelector("[data-output-rotation]")).toHaveAttribute(
      "data-output-rotation",
      "180",
    );
  });

  it.each([
    ["no flips", false, false, "Rotate 90 CW"],
    ["horizontal flip", true, false, "Rotate 90 CCW"],
    ["vertical flip", false, true, "Rotate 90 CCW"],
    ["both flips", true, true, "Rotate 90 CW"],
  ] as const)("wraps 270 to 360 continuously with %s", (_name, horizontal, vertical, action) => {
    const store = createAppStore();
    store.dispatch(rotationChanged(270));
    if (horizontal) store.dispatch(flipToggled("horizontal"));
    if (vertical) store.dispatch(flipToggled("vertical"));
    const { container } = renderVideoPreview(readyPreview("easytrim-media://preview-1"), store);
    const viewport = container.querySelector('[aria-label="Video crop preview"]')!;

    selectTransformAction(viewport, action);

    expect(store.getState().crop.rotationDegrees).toBe(0);
    expect(container.querySelector("[data-output-rotation]")).toHaveAttribute(
      "data-output-rotation",
      "360",
    );
  });

  it("keeps the original right half visible after rotating the normalized crop", () => {
    const store = createAppStore();
    store.dispatch(
      cropChanged({
        crop: { x: 0.5, y: 0, width: 0.5, height: 1 },
        resolution: { width: 960, height: 1080 },
      }),
    );
    store.dispatch(rotationChanged(90));
    store.dispatch(flipToggled("horizontal"));
    store.dispatch(flipToggled("vertical"));
    const { container } = renderVideoPreview(readyPreview("easytrim-media://preview-1"), store);

    expect(store.getState().crop.value).toEqual({ x: 0, y: 0.5, width: 1, height: 0.5 });
    expect(container.querySelector("[data-preview-frame]")).toHaveAttribute(
      "data-aspect-ratio",
      "1.125",
    );
    expect(container.querySelector("[data-rotating-output]")).toHaveStyle({
      width: `${100 / 1.125}%`,
      height: `${1.125 * 100}%`,
    });
    expect(container.querySelector("[data-full-rotated-source]")).toHaveAttribute(
      "data-source-geometry",
      "crop-relative-source",
    );
    expect(container.querySelector("video")).toHaveAttribute("data-presentation-rotation", "90");
    expect(container.querySelector("video")).toHaveStyle({
      left: "-100%",
      top: "0%",
      width: "200%",
      height: "100%",
    });
    expect(container.querySelector("[data-flip-layer]")).toHaveAttribute(
      "data-flip-horizontal",
      "true",
    );
    expect(container.querySelector("[data-flip-layer]")).toHaveAttribute(
      "data-flip-vertical",
      "true",
    );
  });

  it.each([
    ["no flips", false, false],
    ["horizontal", true, false],
    ["vertical", false, true],
    ["both", true, true],
  ] as const)(
    "opens and closes the editor around a rotated crop with %s output flips",
    async (_name, horizontal, vertical) => {
      const store = createAppStore();
      store.dispatch(
        cropChanged({
          crop: { x: 0.5, y: 0, width: 0.5, height: 1 },
          resolution: { width: 960, height: 1080 },
        }),
      );
      store.dispatch(rotationChanged(90));
      if (horizontal) store.dispatch(flipToggled("horizontal"));
      if (vertical) store.dispatch(flipToggled("vertical"));
      const { container } = renderVideoPreview(readyPreview("easytrim-media://preview-1"), store);
      const viewport = container.querySelector('[aria-label="Video crop preview"]')!;

      openCropTool(viewport);

      const selection = container.querySelector("[data-crop-selection]");
      expect(selection).toHaveStyle({ left: "0%", top: "0%", width: "100%", height: "100%" });
      expect(selection).toHaveAttribute("data-source-crop-x", "0.5");
      expect(selection).toHaveAttribute("data-source-crop-y", "0");
      expect(selection).toHaveAttribute("data-source-crop-width", "0.5");
      expect(selection).toHaveAttribute("data-source-crop-height", "1");
      expect(container.querySelector("[data-flip-layer]")).toHaveAttribute(
        "data-flip-horizontal",
        String(horizontal),
      );
      expect(container.querySelector("[data-flip-layer]")).toHaveAttribute(
        "data-flip-vertical",
        String(vertical),
      );
      const rotatingOutput = container.querySelector("[data-rotating-output]");
      expect(rotatingOutput).toContainElement(container.querySelector("[data-crop-clip]"));
      expect(rotatingOutput).toContainElement(
        container.querySelector("[data-crop-selection-coordinate-space]"),
      );

      const visibleTopLeftHandle = horizontal
        ? vertical
          ? "bottom left"
          : "top left"
        : vertical
          ? "bottom right"
          : "top right";

      expect(
        screen.getByRole("button", { name: `Resize crop from ${visibleTopLeftHandle}` }),
      ).toBeInTheDocument();

      fireEvent.click(viewport);
      await waitForElementToBeRemoved(() => container.querySelector("[data-crop-selection]"));

      expect(container.querySelector("[data-source-geometry]")).toHaveAttribute(
        "data-source-geometry",
        "crop-relative-source",
      );
      expect(container.querySelector("[data-flip-layer]")).toHaveAttribute(
        "data-flip-horizontal",
        String(horizontal),
      );
      expect(container.querySelector("[data-flip-layer]")).toHaveAttribute(
        "data-flip-vertical",
        String(vertical),
      );
    },
  );

  it("starts each preview source at its own normalized presentation angle", () => {
    const store = createAppStore();
    store.dispatch(rotationChanged(270));
    const { container } = renderVideoPreview(readyPreview("easytrim-media://preview-1"), store);

    expect(store.getState().crop.rotationDegrees).toBe(270);
    expect(container.querySelector("video")).toHaveAttribute("data-presentation-rotation", "270");

    act(() => store.dispatch(rotationChanged(0)));
    expect(container.querySelector("video")).toHaveAttribute("data-presentation-rotation", "360");

    act(() => {
      store.dispatch(previewReady({ preview: readyPreview("easytrim-media://preview-2").value }));
    });
    expect(store.getState().crop.rotationDegrees).toBe(0);
    expect(container.querySelector("video")).toHaveAttribute("data-presentation-rotation", "0");
  });

  it("confirms before resetting preview transformations", () => {
    const store = createAppStore();
    const { container } = renderVideoPreview(readyPreview("easytrim-media://preview-1"), store);

    const viewport = container.querySelector('[aria-label="Video crop preview"]')!;
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

  it.each([false, true])("resets a transformed partial crop while editor open=%s", (cropOpen) => {
    const store = createAppStore();
    store.dispatch(
      cropChanged({
        crop: { x: 0.15, y: 0.2, width: 0.6, height: 0.5 },
        resolution: { width: 576, height: 450 },
      }),
    );
    store.dispatch(rotationChanged(270));
    store.dispatch(flipToggled("horizontal"));
    store.dispatch(flipToggled("vertical"));
    const { container } = renderVideoPreview(readyPreview("easytrim-media://preview-1"), store);
    const viewport = container.querySelector('[aria-label="Video crop preview"]')!;

    if (cropOpen) openCropTool(viewport);
    selectTransformAction(viewport, "Reset");
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));

    expect(store.getState().crop).toMatchObject({
      flipHorizontal: false,
      flipVertical: false,
      rotationDegrees: 0,
      value: { x: 0, y: 0, width: 1, height: 1 },
    });
    expect(container.querySelector("video")).toHaveAttribute("data-presentation-rotation", "360");
    expect(container.querySelector("[data-flip-layer]")).toHaveAttribute(
      "data-flip-horizontal",
      "false",
    );
    expect(container.querySelector("[data-source-geometry]")).toHaveAttribute(
      "data-source-geometry",
      cropOpen ? "full-rotated-source" : "crop-relative-source",
    );
  });

  it("toggles playback on a left click and supports the context menu", async () => {
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
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Resize crop from top left" })).toBeVisible(),
    );
  });

  it("closes crop controls with Escape or when focus leaves the preview", async () => {
    const { container } = renderVideoPreview(readyPreview("easytrim-media://preview-1"));

    const viewport = container.querySelector('[aria-label="Video crop preview"]');
    expect(viewport).not.toBeNull();

    openCropTool(viewport!);
    fireEvent.keyDown(viewport!, { key: "Escape" });
    await waitForElementToBeRemoved(() =>
      screen.queryByRole("button", { name: "Resize crop from top left" }),
    );

    openCropTool(viewport!);
    fireEvent.blur(viewport!, { relatedTarget: document.body });
    await waitForElementToBeRemoved(() =>
      screen.queryByRole("button", { name: "Resize crop from top left" }),
    );
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

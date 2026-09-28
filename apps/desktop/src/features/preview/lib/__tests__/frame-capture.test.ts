import { beforeEach, describe, expect, it, vi } from "vitest";

import { capturePreviewFrame, frameFileNameFor, frameNumberAt } from "../frame-capture";

describe("capturePreviewFrame", () => {
  const context = {
    drawImage: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn(),
    translate: vi.fn(),
  };

  const video = {
    readyState: HTMLMediaElement.HAVE_CURRENT_DATA,
    videoHeight: 1080,
    videoWidth: 1920,
  } as HTMLVideoElement;

  beforeEach(() => {
    context.drawImage.mockClear();
    context.rotate.mockClear();
    context.scale.mockClear();
    context.translate.mockClear();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      context as unknown as CanvasRenderingContext2D,
    );
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback) => {
      callback(new Blob(["png"]));
    });
  });

  it("captures the selected source region with its active rotation and flips", async () => {
    const crop = { height: 0.5, width: 0.25, x: 0.1, y: 0.2 };
    const blob = await capturePreviewFrame(video, crop, 90, true, false);
    expect(blob.type).toBe("");
    expect(context.rotate).toHaveBeenCalledWith(Math.PI / 2);
    expect(context.scale).toHaveBeenCalledWith(-1, 1);
    expect(context.drawImage).toHaveBeenCalledWith(video, 384, 702, 960, 270, -480, -135, 960, 270);
  });

  it("rejects capture until the video has a decoded frame", async () => {
    const unavailableVideo = {
      ...video,
      readyState: HTMLMediaElement.HAVE_METADATA,
    } as HTMLVideoElement;

    await expect(
      capturePreviewFrame(unavailableVideo, { height: 1, width: 1, x: 0, y: 0 }, 0, false, false),
    ).rejects.toThrow("The preview frame is not ready.");
  });
});

describe("frame output names", () => {
  it("uses a source basename and rational source frame rate", () => {
    expect(frameNumberAt(1.5, { denominator: 2, numerator: 24 })).toBe(18);
    expect(frameFileNameFor("my.clip.mp4", 18)).toBe("my.clip_18.png");
  });

  it("uses the frame whose presentation interval contains the timestamp", () => {
    const tenFramesPerSecond = { denominator: 1, numerator: 10 };
    expect(frameNumberAt(0.06, tenFramesPerSecond)).toBe(0);
    expect(frameNumberAt(0.09999999999999999, tenFramesPerSecond)).toBe(1);
    expect(frameNumberAt(0.06, undefined)).toBe(0);
    expect(frameNumberAt(0.16, undefined)).toBe(1);
  });

  it("sanitizes source names and falls back when the frame rate is missing", () => {
    expect(frameFileNameFor("clip.mp4", frameNumberAt(2.25, undefined))).toBe("clip_22.png");
    expect(frameFileNameFor("../clip?.mp4", 1)).toBe("clip__1.png");
  });
});

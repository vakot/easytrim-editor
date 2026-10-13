import { afterEach, describe, expect, it, vi } from "vitest";

import { createPreviewSeekScheduler } from "../preview-seek-scheduler";

function decoder() {
  const video = document.createElement("video");
  let seconds = 0;
  let seeking = false;
  const assignments = vi.fn((next: number) => {
    seconds = next;
    seeking = true;
  });

  Object.defineProperties(video, {
    currentTime: { get: () => seconds, set: assignments },
    seeking: { get: () => seeking },
  });
  return {
    video,
    assignments,
    finish() {
      seeking = false;
      video.dispatchEvent(new Event("seeked"));
    },
  };
}

function mockAnimationFrames() {
  const callbacks = new Map<number, FrameRequestCallback>();
  let nextId = 1;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    const id = nextId++;
    callbacks.set(id, callback);
    return id;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => callbacks.delete(id));

  return () => {
    const scheduled = [...callbacks.values()];
    callbacks.clear();
    for (const callback of scheduled) callback(0);
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("decoder seek backpressure", () => {
  it("retargets an in-flight seek to the latest destination", () => {
    const flushAnimationFrame = mockAnimationFrames();
    const media = decoder();
    const scheduler = createPreviewSeekScheduler(media.video);
    for (let index = 1; index <= 1_000; index++) scheduler.seek(index * 14);
    expect(media.assignments).toHaveBeenCalledOnce();
    flushAnimationFrame();
    expect(media.assignments).toHaveBeenCalledTimes(2);
    expect(media.video.currentTime).toBe(14_000);
    expect(scheduler.isPending).toBe(true);
    media.finish();
    expect(scheduler.isPending).toBe(false);
    scheduler.dispose();
  });

  it("settles only the newest request after replacing an active destination", () => {
    const flushAnimationFrame = mockAnimationFrames();
    const media = decoder();
    const scheduler = createPreviewSeekScheduler(media.video);
    const stale = vi.fn();
    const latest = vi.fn();
    scheduler.seek(10, false, stale);
    scheduler.seek(99, false, latest);
    flushAnimationFrame();

    expect(media.video.currentTime).toBe(99);
    media.finish();

    expect(stale).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledOnce();
    scheduler.dispose();
  });

  it("uses fast seeks for dragging and an exact seek even at the same release target", () => {
    const flushAnimationFrame = mockAnimationFrames();
    const media = decoder();
    media.video.fastSeek = vi.fn(media.assignments);
    const scheduler = createPreviewSeekScheduler(media.video);
    scheduler.seek(12.25, true);
    scheduler.seek(12.25);
    flushAnimationFrame();
    expect(media.video.fastSeek).toHaveBeenCalled();
    expect(media.assignments).toHaveBeenCalledTimes(2);
    expect(media.assignments).toHaveBeenLastCalledWith(12.25);
    media.finish();
    scheduler.dispose();
  });

  it("retries only the latest target when metadata becomes available", () => {
    const media = decoder();
    media.assignments.mockImplementationOnce(() => {
      throw new Error("no metadata");
    });
    const scheduler = createPreviewSeekScheduler(media.video);
    scheduler.seek(10);
    scheduler.seek(20);
    media.video.dispatchEvent(new Event("loadedmetadata"));
    expect(media.assignments).toHaveBeenCalledTimes(2);
    media.finish();
    expect(media.video.currentTime).toBe(20);
    expect(scheduler.isPending).toBe(false);
    scheduler.dispose();
  });

  it("drops queued work and listeners on source replacement", () => {
    const flushAnimationFrame = mockAnimationFrames();
    const media = decoder();
    const scheduler = createPreviewSeekScheduler(media.video);
    const resume = vi.fn();
    scheduler.seek(10);
    scheduler.seek(20, false, resume);
    scheduler.dispose();
    flushAnimationFrame();
    media.finish();
    scheduler.seek(30);
    expect(media.assignments).toHaveBeenCalledOnce();
    expect(resume).not.toHaveBeenCalled();
  });

  it("ignores invalid destinations without touching the decoder", () => {
    const media = decoder();
    const scheduler = createPreviewSeekScheduler(media.video);
    for (const target of [NaN, Infinity, -1]) scheduler.seek(target);
    expect(media.assignments).not.toHaveBeenCalled();
    scheduler.dispose();
  });
});

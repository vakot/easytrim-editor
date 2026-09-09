import { describe, expect, it, vi } from "vitest";

import { createSeekScheduler } from "../seek-scheduler";

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

describe("decoder seek backpressure", () => {
  it("bounds a burst of 1,000 seeks to the active and latest destination", () => {
    const media = decoder();
    const scheduler = createSeekScheduler(media.video);
    for (let index = 1; index <= 1_000; index++) scheduler.seek(index * 14);
    expect(media.assignments).toHaveBeenCalledTimes(1);
    expect(scheduler.isPending).toBe(true);
    media.finish();
    expect(media.assignments).toHaveBeenCalledTimes(2);
    expect(media.assignments).toHaveBeenLastCalledWith(14_000);
    media.finish();
    expect(scheduler.isPending).toBe(false);
    scheduler.dispose();
  });

  it("replaces stale completion callbacks and resumes only at the final position", () => {
    const media = decoder();
    const scheduler = createSeekScheduler(media.video);
    const stale = vi.fn();
    const resume = vi.fn();
    scheduler.seek(10, false, stale);
    scheduler.seek(99, false, resume);
    media.finish();
    expect(stale).not.toHaveBeenCalled();
    expect(resume).not.toHaveBeenCalled();
    media.finish();
    expect(resume).toHaveBeenCalledOnce();
    scheduler.dispose();
  });

  it("uses fast seeks for dragging and an exact seek even at the same release target", () => {
    const media = decoder();
    media.video.fastSeek = vi.fn(media.assignments);
    const scheduler = createSeekScheduler(media.video);
    scheduler.seek(12.25, true);
    scheduler.seek(12.25);
    expect(media.video.fastSeek).toHaveBeenCalledOnce();
    media.finish();
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
    const scheduler = createSeekScheduler(media.video);
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
    const media = decoder();
    const scheduler = createSeekScheduler(media.video);
    const resume = vi.fn();
    scheduler.seek(10);
    scheduler.seek(20, false, resume);
    scheduler.dispose();
    media.finish();
    scheduler.seek(30);
    expect(media.assignments).toHaveBeenCalledTimes(1);
    expect(resume).not.toHaveBeenCalled();
  });

  it("ignores invalid destinations without touching the decoder", () => {
    const media = decoder();
    const scheduler = createSeekScheduler(media.video);
    for (const target of [NaN, Infinity, -1]) scheduler.seek(target);
    expect(media.assignments).not.toHaveBeenCalled();
    scheduler.dispose();
  });
});

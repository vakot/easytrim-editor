import { describe, expect, it } from "vitest";

import { syncPlayheadElements } from "../media-sync";

describe("syncPlayheadElements", () => {
  it("moves the main, audio, and webcam playheads together", () => {
    const playhead = document.createElement("button");
    const audioPlayhead = document.createElement("div");
    const webcamPlayhead = document.createElement("div");

    syncPlayheadElements(playhead, audioPlayhead, webcamPlayhead, 2_500_000, 10_000_000);

    expect(playhead.style.left).toBe("25%");
    expect(audioPlayhead.style.left).toBe("25%");
    expect(webcamPlayhead.style.left).toBe("25%");
    expect(playhead).toHaveAttribute("aria-valuenow", "2500000");
    expect(playhead).toHaveAttribute("aria-valuetext", "2.500 seconds");
  });

  it("keeps optional track playheads nullable", () => {
    const playhead = document.createElement("button");

    expect(() => syncPlayheadElements(playhead, null, null, 1_000_000, 0)).not.toThrow();
    expect(playhead.style.left).toBe("0%");
  });
});

import { afterEach, describe, expect, it } from "vitest";

import { STORAGE_KEYS } from "@/lib/storage";
import { DEFAULT_TOOL_DEFAULTS, loadToolDefaults, persistToolDefaults } from "../tool-settings";

afterEach(() => localStorage.clear());

describe("tool settings", () => {
  it("loads saved booleans while falling back for invalid values", () => {
    localStorage.setItem(
      STORAGE_KEYS.preferences,
      JSON.stringify({
        theme: "dark",
        toolDefaults: {
          safeTrimFollowingEnabled: false,
          loopPlaybackEnabled: "yes",
          segmentPlaybackEnabled: true,
        },
      }),
    );

    expect(loadToolDefaults()).toEqual({
      ...DEFAULT_TOOL_DEFAULTS,
      safeTrimFollowingEnabled: false,
      segmentPlaybackEnabled: true,
    });
  });

  it("persists settings without overwriting unrelated preferences", () => {
    localStorage.setItem(STORAGE_KEYS.preferences, JSON.stringify({ theme: "dark" }));

    persistToolDefaults({
      safeTrimFollowingEnabled: false,
      loopPlaybackEnabled: true,
      segmentPlaybackEnabled: false,
      mergeAudioEnabled: true,
    });

    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.preferences) ?? "{}")).toEqual({
      theme: "dark",
      toolDefaults: {
        safeTrimFollowingEnabled: false,
        loopPlaybackEnabled: true,
        segmentPlaybackEnabled: false,
        mergeAudioEnabled: true,
      },
    });
  });
});

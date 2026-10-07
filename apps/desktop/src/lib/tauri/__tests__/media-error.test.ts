import { describe, expect, it } from "vitest";

import { normalizeAppError } from "../media.utils";

describe("normalizeAppError", () => {
  it("preserves machine code, semantic ID, interpolation arguments, and diagnostics", () => {
    expect(
      normalizeAppError({
        code: "waveform_failed",
        messageId: "media.waveform.widthOutOfRange",
        messageArgs: { minWidth: "64", maxWidth: "4096", unsafe: { path: "private" } },
        diagnostics: "FFmpeg exit status 1",
      }),
    ).toEqual({
      code: "waveform_failed",
      messageId: "media.waveform.widthOutOfRange",
      messageArgs: { minWidth: "64", maxWidth: "4096" },
      diagnostics: "FFmpeg exit status 1",
    });
  });

  it("keeps legacy messages as diagnostics for a generic UI fallback", () => {
    expect(normalizeAppError({ code: "probe_failed", message: "C:/private.mp4 failed" })).toEqual({
      code: "probe_failed",
      diagnostics: "C:/private.mp4 failed",
    });
  });

  it("normalizes malformed rejections into internal diagnostics", () => {
    expect(normalizeAppError(new Error("unexpected failure"))).toEqual({
      code: "internal",
      messageId: "internal.unexpected",
      diagnostics: "unexpected failure",
    });
    expect(normalizeAppError("raw failure")).toEqual({
      code: "internal",
      messageId: "internal.unexpected",
      diagnostics: "raw failure",
    });
    expect(normalizeAppError({ unexpected: "C:/private.mp4" })).toEqual({
      code: "internal",
      messageId: "internal.unexpected",
      diagnostics: '{"unexpected":"C:/private.mp4"}',
    });
  });
});

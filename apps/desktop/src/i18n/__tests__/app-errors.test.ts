import { describe, expect, it } from "vitest";

import { localizeAppError } from "../app-errors";
import { i18n } from "../config";

describe("localizeAppError", () => {
  it("resolves a semantic native error in every supported locale", () => {
    for (const language of ["en", "ru", "sk"] as const) {
      expect(
        localizeAppError(
          { code: "unsupported_media", messageId: "source.fileTypeIsNotSupportedYet" },
          i18n.getFixedT(language),
        ),
      ).toBe("This file type is not supported yet.");
    }
  });

  it("interpolates safe arguments", () => {
    expect(
      localizeAppError(
        {
          code: "invalid_request",
          messageId: "media.waveform.widthOutOfRange",
          messageArgs: { minWidth: 64, maxWidth: 4096 },
        },
        i18n.getFixedT("en"),
      ),
    ).toBe("Waveform width must be between 64 and 4096 pixels.");
  });

  it("uses a generic localized fallback without displaying diagnostics or legacy text", () => {
    for (const error of [
      { code: "internal", diagnostics: "private path C:/Media/secret.mp4" },
      { code: "future_code", messageId: "future.unknown", diagnostics: "private detail" },
    ]) {
      expect(localizeAppError(error, i18n.getFixedT("en"))).toBe("Something went wrong.");
    }
  });
});

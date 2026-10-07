import { describe, expect, it } from "vitest";

import { normalizeAppError } from "@/lib/tauri/media.utils";

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

  it.each([
    {
      messageArgs: undefined,
      messageId: "media.waveform.widthOutOfRange",
    },
    {
      messageArgs: { minWidth: 64 },
      messageId: "media.waveform.widthOutOfRange",
    },
    {
      messageArgs: { streamIndex: "2" },
      messageId: "media.waveform.analysisFailed",
    },
  ])(
    "falls back when $messageId has missing or unusable arguments",
    ({ messageArgs, messageId }) => {
      expect(
        localizeAppError({ code: "invalid_request", messageId, messageArgs }, i18n.getFixedT("en")),
      ).toBe(i18n.getFixedT("en")("app.errors.unexpected"));
    },
  );

  it("discards non-primitive arguments and keeps their diagnostics out of localized copy", () => {
    const error = normalizeAppError({
      code: "invalid_request",
      messageId: "media.waveform.widthOutOfRange",
      messageArgs: { minWidth: { value: 64 }, maxWidth: 4096 },
      diagnostics: "malformed native arguments",
    });

    expect(error.messageArgs).toEqual({ maxWidth: 4096 });
    expect(error.diagnostics).toBe("malformed native arguments");
    expect(localizeAppError(error, i18n.getFixedT("en"))).toBe(
      i18n.getFixedT("en")("app.errors.unexpected"),
    );
  });

  it("uses a generic localized fallback without displaying diagnostics or legacy text", () => {
    const expectedByLanguage = {
      en: "An unexpected application error occurred.",
      ru: "Произошла непредвиденная ошибка приложения.",
      sk: "V aplikácii sa vyskytla neočakávaná chyba.",
    };

    for (const error of [
      { code: "internal", diagnostics: "private path C:/Media/secret.mp4" },
      { code: "future_code", messageId: "future.unknown", diagnostics: "private detail" },
    ]) {
      for (const language of ["en", "ru", "sk"] as const) {
        expect(localizeAppError(error, i18n.getFixedT(language))).toBe(
          expectedByLanguage[language],
        );
      }
    }
  });
});

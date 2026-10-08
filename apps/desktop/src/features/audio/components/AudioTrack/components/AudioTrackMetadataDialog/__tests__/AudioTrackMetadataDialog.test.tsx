import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import type { AudioTrackController } from "../../../../../hooks/useAudioTrackController";
import { AudioTrackMetadataDialog } from "../AudioTrackMetadataDialog";
import { useAudioTrackMetadataDialog } from "../contexts/audio-track-metadata-dialog-context";

function OpenMetadataDialogButton() {
  const { openMetadataDialog } = useAudioTrackMetadataDialog();

  return (
    <button onClick={openMetadataDialog} type="button">
      Open metadata
    </button>
  );
}

describe("AudioTrackMetadataDialog", () => {
  it.each([
    { expected: "English", sourceLanguage: "eng" },
    { expected: "Select a language", sourceLanguage: "unsupported" },
  ])(
    "resets the language override to the source language when it is $sourceLanguage",
    async ({ expected, sourceLanguage }) => {
      const user = userEvent.setup();
      const controller = {
        stream: { language: sourceLanguage, streamIndex: 0, title: "Source title" },
        track: { metadata: { language: "ces" }, streamIndex: 0 },
        updateMetadata: () => {},
      } as unknown as AudioTrackController;

      render(
        <AudioTrackMetadataDialog controller={controller}>
          <OpenMetadataDialogButton />
        </AudioTrackMetadataDialog>,
      );

      await user.click(screen.getByRole("button", { name: "Open metadata" }));
      await user.click(screen.getByRole("button", { name: "Use source language" }));

      expect(screen.getByRole("button", { name: "Language" })).toHaveTextContent(expected);
    },
  );
});

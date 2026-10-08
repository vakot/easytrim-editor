import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

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
  it("restores a saved custom title when reopening the dialog", async () => {
    const user = userEvent.setup();
    const track: { metadata: { title?: string }; streamIndex: number } = {
      metadata: {},
      streamIndex: 0,
    };

    const controller = {
      stream: { streamIndex: 0, title: "Source title" },
      track,
      updateMetadata: vi.fn((title: string, titleChanged: boolean) => {
        if (titleChanged) track.metadata.title = title === "" ? undefined : title;
      }),
    } as unknown as AudioTrackController;

    render(
      <AudioTrackMetadataDialog controller={controller}>
        <OpenMetadataDialogButton />
      </AudioTrackMetadataDialog>,
    );

    await user.click(screen.getByRole("button", { name: "Open metadata" }));
    const titleInput = screen.getByRole("textbox", { name: "Track title" });
    expect(titleInput).toHaveValue("");
    expect(titleInput).toHaveAttribute("placeholder", "Source title");

    await user.type(titleInput, "Saved custom title");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await user.click(screen.getByRole("button", { name: "Open metadata" }));

    expect(screen.getByRole("textbox", { name: "Track title" })).toHaveValue("Saved custom title");
  });

  it("preserves an existing custom title when saving without changes", async () => {
    const user = userEvent.setup();
    const track: { metadata: { language?: string; title?: string }; streamIndex: number } = {
      metadata: { language: "ces", title: "Existing custom title" },
      streamIndex: 0,
    };

    const controller = {
      stream: { language: "eng", streamIndex: 0, title: "Source title" },
      track,
      updateMetadata: vi.fn((title: string, titleChanged: boolean) => {
        if (titleChanged) track.metadata.title = title === "" ? undefined : title;
      }),
    } as unknown as AudioTrackController;

    render(
      <AudioTrackMetadataDialog controller={controller}>
        <OpenMetadataDialogButton />
      </AudioTrackMetadataDialog>,
    );

    await user.click(screen.getByRole("button", { name: "Open metadata" }));
    expect(screen.getByRole("textbox", { name: "Track title" })).toHaveValue(
      "Existing custom title",
    );
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(controller.updateMetadata).toHaveBeenCalledWith(
      "Existing custom title",
      false,
      "cs",
      false,
    );
    expect(track.metadata.title).toBe("Existing custom title");
    expect(track.metadata.language).toBe("ces");
  });

  it("clears a custom title to restore the source title placeholder", async () => {
    const user = userEvent.setup();
    const track: { metadata: { title?: string }; streamIndex: number } = {
      metadata: { title: "Existing custom title" },
      streamIndex: 0,
    };

    const controller = {
      stream: { streamIndex: 0, title: "Source title" },
      track,
      updateMetadata: vi.fn((title: string, titleChanged: boolean) => {
        if (titleChanged) track.metadata.title = title === "" ? undefined : title;
      }),
    } as unknown as AudioTrackController;

    render(
      <AudioTrackMetadataDialog controller={controller}>
        <OpenMetadataDialogButton />
      </AudioTrackMetadataDialog>,
    );

    await user.click(screen.getByRole("button", { name: "Open metadata" }));
    await user.clear(screen.getByRole("textbox", { name: "Track title" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(controller.updateMetadata).toHaveBeenCalledWith("", true, undefined, false);
    expect(track.metadata.title).toBeUndefined();

    await user.click(screen.getByRole("button", { name: "Open metadata" }));
    expect(screen.getByRole("textbox", { name: "Track title" })).toHaveValue("");
    expect(screen.getByRole("textbox", { name: "Track title" })).toHaveAttribute(
      "placeholder",
      "Source title",
    );
  });

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

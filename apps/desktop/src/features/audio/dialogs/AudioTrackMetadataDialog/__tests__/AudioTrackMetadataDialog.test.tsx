import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { AudioTrackController } from "../../../hooks/useAudioTrackController";
import {
  AudioTrackMetadataDialog,
  AudioTrackMetadataDialogTrigger,
} from "../AudioTrackMetadataDialog";

function OpenMetadataDialogButton() {
  return (
    <AudioTrackMetadataDialogTrigger asChild>
      <button type="button">Open metadata</button>
    </AudioTrackMetadataDialogTrigger>
  );
}

describe("AudioTrackMetadataDialog", () => {
  it("focuses the title field when the lazy content mounts", async () => {
    const controller = {
      stream: { language: "eng", streamIndex: 0, title: "Source title" },
      track: { metadata: {}, streamIndex: 0 },
      updateMetadata: vi.fn(),
    } as unknown as AudioTrackController;

    render(
      <AudioTrackMetadataDialog controller={controller}>
        <OpenMetadataDialogButton />
      </AudioTrackMetadataDialog>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open metadata" }));

    const titleInput = await screen.findByRole("textbox", { name: "Track title" });
    expect(titleInput).toHaveFocus();
  });

  it("saves edited metadata before closing the dialog", async () => {
    const user = userEvent.setup();
    const controller = {
      stream: { language: "eng", streamIndex: 0, title: "Source title" },
      track: { metadata: {}, streamIndex: 0 },
      updateMetadata: vi.fn(),
    } as unknown as AudioTrackController;

    render(
      <AudioTrackMetadataDialog controller={controller}>
        <OpenMetadataDialogButton />
      </AudioTrackMetadataDialog>,
    );

    await user.click(screen.getByRole("button", { name: "Open metadata" }));
    await user.type(await screen.findByRole("textbox", { name: "Track title" }), "Edited title");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(controller.updateMetadata).toHaveBeenCalledWith("Edited title", true, "en", false);
    expect(screen.queryByRole("textbox", { name: "Track title" })).not.toBeInTheDocument();
  });

  it("closes without saving when the footer Close button is clicked", async () => {
    const user = userEvent.setup();
    const controller = {
      stream: { language: "eng", streamIndex: 0, title: "Source title" },
      track: { metadata: {}, streamIndex: 0 },
      updateMetadata: vi.fn(),
    } as unknown as AudioTrackController;

    render(
      <AudioTrackMetadataDialog controller={controller}>
        <OpenMetadataDialogButton />
      </AudioTrackMetadataDialog>,
    );

    await user.click(screen.getByRole("button", { name: "Open metadata" }));
    await user.type(await screen.findByRole("textbox", { name: "Track title" }), "Unsaved title");
    await user.click(
      within(document.querySelector('[data-slot="dialog-footer"]')!).getByRole("button", {
        name: "Close",
      }),
    );

    expect(controller.updateMetadata).not.toHaveBeenCalled();
    expect(screen.queryByRole("textbox", { name: "Track title" })).not.toBeInTheDocument();
  });

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
    const titleInput = await screen.findByRole("textbox", { name: "Track title" });
    expect(titleInput).toHaveValue("");
    expect(titleInput).toHaveAttribute("placeholder", "Source title");

    await user.type(titleInput, "Saved custom title");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await user.click(screen.getByRole("button", { name: "Open metadata" }));

    expect(await screen.findByRole("textbox", { name: "Track title" })).toHaveValue(
      "Saved custom title",
    );
  });

  it("uses the track row fallback as the title placeholder when the source has no title", async () => {
    const user = userEvent.setup();
    const controller = {
      stream: { language: "und", streamIndex: 0 },
      trackNumber: 1,
      track: { metadata: {}, streamIndex: 0 },
      updateMetadata: vi.fn(),
    } as unknown as AudioTrackController;

    render(
      <AudioTrackMetadataDialog controller={controller}>
        <OpenMetadataDialogButton />
      </AudioTrackMetadataDialog>,
    );

    await user.click(screen.getByRole("button", { name: "Open metadata" }));

    const titleInput = await screen.findByRole("textbox", { name: "Track title" });
    expect(titleInput).toHaveValue("");
    expect(titleInput).toHaveAttribute("placeholder", "und");
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
    expect(await screen.findByRole("textbox", { name: "Track title" })).toHaveValue(
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
    await user.clear(await screen.findByRole("textbox", { name: "Track title" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(controller.updateMetadata).toHaveBeenCalledWith("", true, undefined, false);
    expect(track.metadata.title).toBeUndefined();

    await user.click(screen.getByRole("button", { name: "Open metadata" }));
    const titleInput = await screen.findByRole("textbox", { name: "Track title" });
    expect(titleInput).toHaveValue("");
    expect(titleInput).toHaveAttribute("placeholder", "Source title");
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
      await user.click(await screen.findByRole("button", { name: "Use source language" }));

      expect(screen.getByRole("button", { name: "Language" })).toHaveTextContent(expected);
    },
  );
});

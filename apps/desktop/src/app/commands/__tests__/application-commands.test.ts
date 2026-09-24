import { describe, expect, it, vi } from "vitest";

import {
  APPLICATION_SHORTCUTS,
  type ApplicationCommand,
  filterApplicationCommands,
  getShortcutAriaValue,
  getShortcutDisplayKeys,
  isShortcutEvent,
} from "../application-commands";

const commands: ApplicationCommand[] = [
  {
    enabled: true,
    execute: vi.fn(),
    id: "open-folder",
    label: "Open Folder",
    searchTerms: ["directory", "import"],
    section: { id: "file", label: "File" },
  },
  {
    enabled: false,
    execute: vi.fn(),
    id: "save-lossless-cut",
    label: "Save Lossless Cut",
    searchTerms: ["fast cut", "render"],
    section: { id: "export", label: "Export" },
    shortcut: APPLICATION_SHORTCUTS.saveLosslessCut,
  },
];

describe("application command search", () => {
  it("matches case-insensitive partial command labels with highlight-compatible metadata", () => {
    const [match] = filterApplicationCommands(commands, "FoLd");

    expect(match?.command.id).toBe("open-folder");
    expect(match).toMatchObject({
      labelMatched: true,
      searchTermMatched: false,
      sectionMatched: false,
    });
  });

  it("returns every applicable command when the section matches", () => {
    const matches = filterApplicationCommands(commands, "file");

    expect(matches.map(({ command }) => command.id)).toEqual(["open-folder"]);
    expect(matches[0]).toMatchObject({ labelMatched: false, sectionMatched: true });
  });

  it("matches explicit aliases without claiming a visible label match", () => {
    const [match] = filterApplicationCommands(commands, "direc");

    expect(match?.command.id).toBe("open-folder");
    expect(match).toMatchObject({
      labelMatched: false,
      searchTermMatched: true,
      sectionMatched: false,
    });
  });

  it("preserves enabled state and commands without shortcuts", () => {
    const matches = filterApplicationCommands(commands, "");

    expect(matches[0]?.command.enabled).toBe(true);
    expect(matches[0]?.command.shortcut).toBeUndefined();
    expect(matches[1]?.command).toMatchObject({ enabled: false });
  });
});

describe("application command shortcuts", () => {
  it("formats the primary modifier for Windows/Linux and macOS", () => {
    expect(getShortcutDisplayKeys(APPLICATION_SHORTCUTS.commandPalette, "other")).toEqual([
      "Ctrl",
      "H",
    ]);
    expect(getShortcutAriaValue(APPLICATION_SHORTCUTS.commandPalette, "other")).toBe("Control+H");
    expect(getShortcutDisplayKeys(APPLICATION_SHORTCUTS.commandPalette, "macos")).toEqual([
      "Cmd",
      "H",
    ]);
    expect(getShortcutAriaValue(APPLICATION_SHORTCUTS.commandPalette, "macos")).toBe("Meta+H");
    expect(getShortcutDisplayKeys(APPLICATION_SHORTCUTS.openFolder, "macos")).toEqual([
      "Ctrl",
      "K",
    ]);
    expect(getShortcutDisplayKeys(APPLICATION_SHORTCUTS.saveLosslessCut, "macos")).toEqual([
      "Ctrl",
      "S",
    ]);
  });

  it("matches only the platform primary modifier", () => {
    const controlH = new KeyboardEvent("keydown", { code: "KeyH", ctrlKey: true });
    const commandH = new KeyboardEvent("keydown", { code: "KeyH", metaKey: true });

    expect(isShortcutEvent(controlH, APPLICATION_SHORTCUTS.commandPalette, "other")).toBe(true);
    expect(isShortcutEvent(commandH, APPLICATION_SHORTCUTS.commandPalette, "other")).toBe(false);
    expect(isShortcutEvent(commandH, APPLICATION_SHORTCUTS.commandPalette, "macos")).toBe(true);
    expect(isShortcutEvent(controlH, APPLICATION_SHORTCUTS.commandPalette, "macos")).toBe(false);
  });
});

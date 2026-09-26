import { describe, expect, it, vi } from "vitest";

import { COMMAND_PALETTE_SHORTCUT } from "../core/application-command.shortcuts";
import type {
  ApplicationCommand,
  ApplicationCommandDefinition,
} from "../core/application-command.types";
import {
  assertUniqueCommandIds,
  filterApplicationCommands,
  getShortcutAriaValue,
  getShortcutDisplayKeys,
  isApplicationCommandAvailableOnSurface,
  isShortcutEvent,
  materializeApplicationCommands,
} from "../core/application-command.utils";

const fileShortcuts = {
  openFolder: { code: "KeyK", key: "K", modifier: "control" },
  saveLosslessCut: { code: "KeyS", key: "S", modifier: "control" },
} as const;

const commands: ApplicationCommand[] = [
  {
    enabled: true,
    icon: null,
    id: "open-folder",
    label: "Open Folder",
    pending: false,
    searchTerms: ["directory", "import"],
    group: { id: "file", label: "File" },
    variant: "default",
  },
  {
    enabled: false,
    icon: null,
    id: "save-lossless-cut",
    label: "Save Lossless Cut",
    pending: false,
    searchTerms: ["fast cut", "render"],
    group: { id: "export", label: "Export" },
    shortcut: fileShortcuts.saveLosslessCut,
    variant: "default",
  },
];

function searchableCommand(id: string, label: string): ApplicationCommand {
  return {
    enabled: true,
    icon: null,
    id,
    label,
    pending: false,
    searchTerms: [],
    group: { id: "games", label: "Game Capture" },
    variant: "default",
  };
}

describe("application command search", () => {
  it("matches case-insensitive partial command labels with highlight-compatible metadata", () => {
    const [match] = filterApplicationCommands(commands, "FoLd");

    expect(match?.command.id).toBe("open-folder");
    expect(match).toMatchObject({
      labelMatched: true,
      labelMatchRanges: [[5, 8]],
      searchTermMatched: false,
      groupMatched: false,
    });
  });

  it("returns every applicable command when the group matches", () => {
    const matches = filterApplicationCommands(commands, "file");

    expect(matches.map(({ command }) => command.id)).toEqual(["open-folder"]);
    expect(matches[0]).toMatchObject({
      labelMatched: false,
      groupMatched: true,
      groupMatchRanges: [[0, 3]],
    });
  });

  it("matches explicit aliases without claiming a visible label match", () => {
    const [match] = filterApplicationCommands(commands, "direc");

    expect(match?.command.id).toBe("open-folder");
    expect(match).toMatchObject({
      labelMatched: false,
      searchTermMatched: true,
      groupMatched: false,
    });
  });

  it("preserves enabled state and commands without shortcuts", () => {
    const matches = filterApplicationCommands(commands, "");

    expect(matches[0]?.command.enabled).toBe(true);
    expect(matches[0]?.command.shortcut).toBeUndefined();
    expect(matches[1]?.command).toMatchObject({ enabled: false });
  });

  it.each(["fast ren", "fast rendr"])("supports token partial and typo queries: %s", (query) => {
    const [match] = filterApplicationCommands(commands, query);

    expect(match?.command.id).toBe("save-lossless-cut");
    expect(match?.searchTermMatched).toBe(true);
  });

  it("ranks the stronger fuzzy command match first", () => {
    const stronger = searchableCommand("strong", "War Thunder Enemy destroyed moment 2026");
    const weaker = searchableCommand("weak", "War Thunder Enemy destroyed moment 2025");

    expect(
      filterApplicationCommands([weaker, stronger], "war thunder enemy destroyed 2026")[0]?.command
        .id,
    ).toBe("strong");
  });

  it("returns no commands for an unrelated query", () => {
    expect(filterApplicationCommands(commands, "unrelated zebra")).toEqual([]);
  });

  it("limits surface-scoped commands while leaving unspecified commands available everywhere", () => {
    const menuOnlyCommand = { surfaces: ["menu"] as const };

    expect(isApplicationCommandAvailableOnSurface(menuOnlyCommand, "menu")).toBe(true);
    expect(isApplicationCommandAvailableOnSurface(menuOnlyCommand, "palette")).toBe(false);
    expect(isApplicationCommandAvailableOnSurface({}, "palette")).toBe(true);
  });

  it("preserves semantic variants and checked state when materializing definitions", () => {
    const definition: ApplicationCommandDefinition = {
      checked: true,
      enabled: true,
      icon: null,
      id: "delete-file",
      label: "Delete File",
      run: vi.fn(),
      searchTerms: [],
      surfaces: ["menu"],
      variant: "destructive",
    };

    expect(
      materializeApplicationCommands(
        [{ id: "source", label: "Source", commands: [definition] }],
        new Set(),
      ),
    ).toEqual([
      expect.objectContaining({
        checked: true,
        group: { id: "source", label: "Source" },
        pending: false,
        surfaces: ["menu"],
        variant: "destructive",
      }),
    ]);
  });
});

describe("application command shortcuts", () => {
  const sourceNavigationShortcut = {
    code: "ArrowLeft",
    key: "LeftArrow",
    modifier: "alt",
  } as const;

  it("formats the primary modifier for Windows/Linux and macOS", () => {
    expect(getShortcutDisplayKeys(COMMAND_PALETTE_SHORTCUT, "other")).toEqual(["Ctrl", "H"]);
    expect(getShortcutAriaValue(COMMAND_PALETTE_SHORTCUT, "other")).toBe("Control+H");
    expect(getShortcutDisplayKeys(COMMAND_PALETTE_SHORTCUT, "macos")).toEqual(["Cmd", "H"]);
    expect(getShortcutAriaValue(COMMAND_PALETTE_SHORTCUT, "macos")).toBe("Meta+H");
    expect(getShortcutDisplayKeys(fileShortcuts.openFolder, "macos")).toEqual(["Ctrl", "K"]);
    expect(getShortcutDisplayKeys(fileShortcuts.saveLosslessCut, "macos")).toEqual(["Ctrl", "S"]);
  });

  it("matches only the platform primary modifier", () => {
    const controlH = new KeyboardEvent("keydown", { code: "KeyH", ctrlKey: true });
    const commandH = new KeyboardEvent("keydown", { code: "KeyH", metaKey: true });

    expect(isShortcutEvent(controlH, COMMAND_PALETTE_SHORTCUT, "other")).toBe(true);
    expect(isShortcutEvent(commandH, COMMAND_PALETTE_SHORTCUT, "other")).toBe(false);
    expect(isShortcutEvent(commandH, COMMAND_PALETTE_SHORTCUT, "macos")).toBe(true);
    expect(isShortcutEvent(controlH, COMMAND_PALETTE_SHORTCUT, "macos")).toBe(false);
  });

  it("formats and matches alt shortcuts", () => {
    const altArrowLeft = new KeyboardEvent("keydown", {
      altKey: true,
      code: "ArrowLeft",
    });

    expect(getShortcutDisplayKeys(sourceNavigationShortcut)).toEqual(["Alt", "LeftArrow"]);
    expect(getShortcutAriaValue(sourceNavigationShortcut)).toBe("Alt+LeftArrow");
    expect(isShortcutEvent(altArrowLeft, sourceNavigationShortcut)).toBe(true);
    expect(
      isShortcutEvent(
        new KeyboardEvent("keydown", { code: "ArrowLeft", ctrlKey: true }),
        sourceNavigationShortcut,
      ),
    ).toBe(false);
  });

  it("detects duplicate command ids while aggregating groups", () => {
    expect(() => assertUniqueCommandIds([{ id: "duplicate" }, { id: "duplicate" }])).toThrow(
      "Duplicate application command id: duplicate",
    );
  });
});

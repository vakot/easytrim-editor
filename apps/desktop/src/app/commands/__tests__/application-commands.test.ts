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
import {
  FAST_EXPORT_SHORTCUT,
  GIF_EXPORT_SHORTCUT,
  OPTIMIZED_EXPORT_SHORTCUT,
} from "../file/file-shortcuts.constants";

const fileShortcuts = {
  openFolder: { code: "KeyK", key: "K", modifier: "control" },
  fastExport: FAST_EXPORT_SHORTCUT,
  gifExport: GIF_EXPORT_SHORTCUT,
  optimizedExport: OPTIMIZED_EXPORT_SHORTCUT,
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
    id: "fast-export",
    label: "Fast Export",
    pending: false,
    searchTerms: ["fast export", "fast"],
    group: { id: "export", label: "Export" },
    shortcut: fileShortcuts.fastExport,
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

  it("supports token partial queries for fast export", () => {
    const query = "fast exp";
    const [match] = filterApplicationCommands(commands, query);

    expect(match?.command.id).toBe("fast-export");
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

  it("formats the command palette shortcut without a modifier", () => {
    expect(getShortcutDisplayKeys(COMMAND_PALETTE_SHORTCUT, "other")).toEqual(["/"]);
    expect(getShortcutAriaValue(COMMAND_PALETTE_SHORTCUT, "other")).toBe("/");
    expect(getShortcutDisplayKeys(COMMAND_PALETTE_SHORTCUT, "macos")).toEqual(["/"]);
    expect(getShortcutAriaValue(COMMAND_PALETTE_SHORTCUT, "macos")).toBe("/");
    expect(getShortcutDisplayKeys(fileShortcuts.openFolder, "macos")).toEqual(["Ctrl", "K"]);
    expect(getShortcutDisplayKeys(fileShortcuts.fastExport, "macos")).toEqual(["Ctrl", "S"]);
    expect(getShortcutDisplayKeys(fileShortcuts.gifExport, "macos")).toEqual(["Ctrl", "G"]);
    expect(getShortcutDisplayKeys(fileShortcuts.optimizedExport, "macos")).toEqual(["Ctrl", "E"]);
    expect(
      new Set([
        fileShortcuts.fastExport.code,
        fileShortcuts.gifExport.code,
        fileShortcuts.optimizedExport.code,
      ]).size,
    ).toBe(3);
  });

  it("matches slash with or without Shift and rejects other modifiers", () => {
    const slash = new KeyboardEvent("keydown", { code: "Slash", key: "/" });
    const shiftedSlash = new KeyboardEvent("keydown", {
      code: "Slash",
      key: "/",
      shiftKey: true,
    });

    const controlSlash = new KeyboardEvent("keydown", { code: "Slash", key: "/", ctrlKey: true });

    expect(isShortcutEvent(slash, COMMAND_PALETTE_SHORTCUT, "other")).toBe(true);
    expect(isShortcutEvent(shiftedSlash, COMMAND_PALETTE_SHORTCUT, "other")).toBe(true);
    expect(isShortcutEvent(controlSlash, COMMAND_PALETTE_SHORTCUT, "other")).toBe(false);
  });

  it("formats and matches alt shortcuts", () => {
    const altArrowLeft = new KeyboardEvent("keydown", {
      altKey: true,
      code: "ArrowLeft",
    });

    expect(getShortcutDisplayKeys(sourceNavigationShortcut)).toEqual(["Alt", "←"]);
    expect(getShortcutAriaValue(sourceNavigationShortcut)).toBe("Alt+LeftArrow");
    expect(isShortcutEvent(altArrowLeft, sourceNavigationShortcut)).toBe(true);
    expect(
      isShortcutEvent(
        new KeyboardEvent("keydown", { code: "ArrowLeft", ctrlKey: true }),
        sourceNavigationShortcut,
      ),
    ).toBe(false);
  });

  it("uses arrow glyphs for timeline arrow shortcuts", () => {
    expect(
      getShortcutDisplayKeys({ code: "ArrowLeft", key: "ArrowLeft", modifier: "none" }),
    ).toEqual(["←"]);
    expect(
      getShortcutDisplayKeys({ code: "ArrowRight", key: "ArrowRight", modifier: "none" }),
    ).toEqual(["→"]);
  });

  it("detects duplicate command ids while aggregating groups", () => {
    expect(() => assertUniqueCommandIds([{ id: "duplicate" }, { id: "duplicate" }])).toThrow(
      "Duplicate application command id: duplicate",
    );
  });
});

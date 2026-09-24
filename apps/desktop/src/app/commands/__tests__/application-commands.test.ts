import { describe, expect, it, vi } from "vitest";

import {
  type ApplicationCommand,
  type ApplicationCommandDefinition,
} from "../application-command.types";
import { COMMAND_PALETTE_SHORTCUT } from "../application-command.shortcuts";
import {
  assertUniqueCommandIds,
  filterApplicationCommands,
  getShortcutAriaValue,
  getShortcutDisplayKeys,
  isShortcutEvent,
  materializeApplicationCommands,
} from "../application-command.utils";

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
    section: { id: "file", label: "File" },
    variant: "default",
  },
  {
    enabled: false,
    icon: null,
    id: "save-lossless-cut",
    label: "Save Lossless Cut",
    pending: false,
    searchTerms: ["fast cut", "render"],
    section: { id: "export", label: "Export" },
    shortcut: fileShortcuts.saveLosslessCut,
    variant: "default",
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

  it("preserves semantic variants and checked state when materializing definitions", () => {
    const definition: ApplicationCommandDefinition = {
      checked: true,
      enabled: true,
      icon: null,
      id: "delete-file",
      label: "Delete File",
      run: vi.fn(),
      searchTerms: [],
      section: { id: "source", label: "Source" },
      variant: "destructive",
    };

    expect(materializeApplicationCommands([definition], new Set())).toEqual([
      expect.objectContaining({ checked: true, pending: false, variant: "destructive" }),
    ]);
  });
});

describe("application command shortcuts", () => {
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

  it("detects duplicate command ids while aggregating groups", () => {
    expect(() => assertUniqueCommandIds([{ id: "duplicate" }, { id: "duplicate" }])).toThrow(
      "Duplicate application command id: duplicate",
    );
  });
});

import type { DiagnosticOrigin } from "@/lib/tauri/diagnostics.types";

type ApplicationCommandId =
  | "close-file"
  | "delete-file"
  | "open-file"
  | "open-folder"
  | "optimized-export"
  | "save-lossless-cut";

type ApplicationCommandSectionId = "export" | "file" | "source";
type ApplicationCommandSurface = "hotkey" | "menu" | "palette";
type ShortcutPlatform = "macos" | "other";

interface ApplicationShortcut {
  code: string;
  key: string;
  modifier: "control" | "primary";
}

interface ApplicationCommandSection {
  id: ApplicationCommandSectionId;
  label: string;
}

interface ApplicationCommand {
  enabled: boolean;
  execute: (surface: ApplicationCommandSurface) => void;
  id: ApplicationCommandId;
  label: string;
  searchTerms: readonly string[];
  section: ApplicationCommandSection;
  shortcut?: ApplicationShortcut;
}

interface ApplicationCommandMatch {
  command: ApplicationCommand;
  labelMatched: boolean;
  searchTermMatched: boolean;
  sectionMatched: boolean;
}

const APPLICATION_SHORTCUTS = {
  closeFile: { code: "KeyQ", key: "Q", modifier: "control" },
  commandPalette: { code: "KeyH", key: "H", modifier: "primary" },
  deleteFile: { code: "KeyD", key: "D", modifier: "control" },
  openFile: { code: "KeyO", key: "O", modifier: "control" },
  openFolder: { code: "KeyK", key: "K", modifier: "control" },
  optimizedExport: { code: "KeyE", key: "E", modifier: "control" },
  saveLosslessCut: { code: "KeyS", key: "S", modifier: "control" },
} as const satisfies Record<string, ApplicationShortcut>;

function filterApplicationCommands(
  commands: readonly ApplicationCommand[],
  query: string,
): ApplicationCommandMatch[] {
  const normalizedQuery = normalizeSearchValue(query);

  return commands.flatMap((command) => {
    if (!normalizedQuery) {
      return [{ command, labelMatched: false, searchTermMatched: false, sectionMatched: false }];
    }

    const labelMatched = normalizeSearchValue(command.label).includes(normalizedQuery);
    const sectionMatched = normalizeSearchValue(command.section.label).includes(normalizedQuery);
    const searchTermMatched = command.searchTerms.some((term) =>
      normalizeSearchValue(term).includes(normalizedQuery),
    );

    return labelMatched || sectionMatched || searchTermMatched
      ? [{ command, labelMatched, searchTermMatched, sectionMatched }]
      : [];
  });
}

function getShortcutDisplayKeys(
  shortcut: ApplicationShortcut,
  platform = getShortcutPlatform(),
): readonly string[] {
  return [shortcut.modifier === "primary" && platform === "macos" ? "Cmd" : "Ctrl", shortcut.key];
}

function getShortcutAriaValue(
  shortcut: ApplicationShortcut,
  platform = getShortcutPlatform(),
): string {
  const modifier = shortcut.modifier === "primary" && platform === "macos" ? "Meta" : "Control";
  return `${modifier}+${shortcut.key}`;
}

function isShortcutEvent(
  event: KeyboardEvent,
  shortcut: ApplicationShortcut,
  platform = getShortcutPlatform(),
): boolean {
  const usesMeta = shortcut.modifier === "primary" && platform === "macos";
  const requiredModifierPressed = usesMeta ? event.metaKey : event.ctrlKey;
  const otherModifierPressed = usesMeta ? event.ctrlKey : event.metaKey;

  return (
    event.code === shortcut.code &&
    requiredModifierPressed &&
    !otherModifierPressed &&
    !event.altKey &&
    !event.shiftKey
  );
}

function commandOrigin(commandId: ApplicationCommandId, surface: ApplicationCommandSurface) {
  const type: DiagnosticOrigin["type"] = surface === "hotkey" ? "hotkey" : "menu";
  return { id: `${surface}.${commandId}`, type } satisfies DiagnosticOrigin;
}

function getShortcutPlatform(): ShortcutPlatform {
  if (typeof navigator === "undefined") return "other";
  return /Mac/i.test(navigator.userAgent) || /Mac/i.test(navigator.platform) ? "macos" : "other";
}

function normalizeSearchValue(value: string): string {
  return value.trim().toLocaleLowerCase();
}

export {
  APPLICATION_SHORTCUTS,
  commandOrigin,
  filterApplicationCommands,
  getShortcutAriaValue,
  getShortcutDisplayKeys,
  isShortcutEvent,
};
export type {
  ApplicationCommand,
  ApplicationCommandId,
  ApplicationCommandMatch,
  ApplicationCommandSection,
  ApplicationCommandSurface,
  ApplicationShortcut,
  ShortcutPlatform,
};

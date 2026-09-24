import type { DiagnosticOrigin } from "@/lib/tauri/diagnostics.types";

type ApplicationCommandId =
  | "activity-feed-view-branch"
  | "activity-feed-view-compact"
  | "activity-feed-view-default"
  | "check-for-updates"
  | "close-file"
  | "crop-preview"
  | "delete-source-on-render-finish"
  | "delete-file"
  | "flip-horizontal"
  | "flip-vertical"
  | "language-en"
  | "language-ru"
  | "language-sk"
  | "layout-density-compact"
  | "layout-density-default"
  | "open-changelog"
  | "open-file"
  | "open-folder"
  | "open-project-page"
  | "open-release-page"
  | "optimized-export"
  | "preference-auto-start-queue"
  | "preference-loop-playback"
  | "preference-merge-audio"
  | "preference-segment-playback"
  | "preference-snap-playback"
  | "primary-color-amber"
  | "primary-color-blue"
  | "primary-color-emerald"
  | "primary-color-rose"
  | "primary-color-violet"
  | "queue-finish-exit"
  | "queue-finish-nothing"
  | "queue-finish-system-shutdown"
  | "queue-finish-system-sleep"
  | "reset-layout"
  | "reset-preferences"
  | "reset-transform"
  | "rotate-180"
  | "rotate-90-ccw"
  | "rotate-90-cw"
  | "save-lossless-cut"
  | "show-logs"
  | "support-project"
  | "theme-dark"
  | "theme-light"
  | "theme-system"
  | "toggle-bottom-panel"
  | "toggle-left-panel";

type ApplicationCommandSectionId =
  | "appearance"
  | "audio"
  | "export"
  | "file"
  | "help"
  | "language"
  | "layout"
  | "playback"
  | "preferences"
  | "preview"
  | "queue"
  | "source";
type ApplicationCommandSurface = "button" | "hotkey" | "menu" | "palette";
type ApplicationCommandVariant = "default" | "destructive" | "success";
type MaybePromise<T> = T | Promise<T>;
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
  checked?: boolean;
  enabled: boolean;
  id: ApplicationCommandId;
  label: string;
  pending: boolean;
  searchTerms: readonly string[];
  section: ApplicationCommandSection;
  shortcut?: ApplicationShortcut;
  variant: ApplicationCommandVariant;
}

interface ApplicationCommandExecutionContext {
  surface: ApplicationCommandSurface;
}

interface ApplicationCommandDefinition extends Omit<ApplicationCommand, "pending"> {
  run: (context: ApplicationCommandExecutionContext) => MaybePromise<void>;
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
  const type: DiagnosticOrigin["type"] =
    surface === "hotkey" ? "hotkey" : surface === "button" ? "button" : "menu";

  return { id: `${surface}.${commandId}`, type } satisfies DiagnosticOrigin;
}

function commandSearchTerms(value: string): string[] {
  return value.split("|").map((term) => term.trim());
}

function commandsById<T extends { id: ApplicationCommandId }>(commands: readonly T[]) {
  return Object.fromEntries(commands.map((command) => [command.id, command])) as Record<
    ApplicationCommandId,
    T
  >;
}

function materializeApplicationCommands(
  definitions: readonly ApplicationCommandDefinition[],
  pendingIds: ReadonlySet<ApplicationCommandId>,
): ApplicationCommand[] {
  return definitions.map((definition) => ({
    checked: definition.checked,
    enabled: definition.enabled,
    id: definition.id,
    label: definition.label,
    pending: pendingIds.has(definition.id),
    searchTerms: definition.searchTerms,
    section: definition.section,
    shortcut: definition.shortcut,
    variant: definition.variant,
  }));
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
  commandsById,
  commandSearchTerms,
  filterApplicationCommands,
  getShortcutAriaValue,
  getShortcutDisplayKeys,
  isShortcutEvent,
  materializeApplicationCommands,
};
export type {
  ApplicationCommand,
  ApplicationCommandDefinition,
  ApplicationCommandExecutionContext,
  ApplicationCommandId,
  ApplicationCommandMatch,
  ApplicationCommandSection,
  ApplicationCommandSurface,
  ApplicationCommandVariant,
  ApplicationShortcut,
  MaybePromise,
  ShortcutPlatform,
};

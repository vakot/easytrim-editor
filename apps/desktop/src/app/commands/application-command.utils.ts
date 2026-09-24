import type {
  ApplicationCommand,
  ApplicationCommandDefinition,
  ApplicationCommandGroup,
  ApplicationCommandMatch,
  ApplicationShortcut,
  ShortcutPlatform,
} from "@/app/commands/application-command.types";

function defineApplicationCommandGroup<
  const Commands extends readonly ApplicationCommandDefinition[],
>(id: string, commands: Commands): ApplicationCommandGroup<Commands> {
  return { commands, id };
}

function commandSearchTerms(value: string): string[] {
  return value.split("|").map((term) => term.trim());
}

function filterApplicationCommands<Id extends string>(
  commands: readonly ApplicationCommand<Id>[],
  query: string,
): ApplicationCommandMatch<Id>[] {
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

function materializeApplicationCommands<Id extends string>(
  definitions: readonly ApplicationCommandDefinition<Id>[],
  pendingIds: ReadonlySet<Id>,
): ApplicationCommand<Id>[] {
  assertUniqueCommandIds(definitions);
  return definitions.map((definition) => ({
    checked: definition.checked,
    enabled: definition.enabled,
    icon: definition.icon,
    id: definition.id,
    label: definition.label,
    pending: pendingIds.has(definition.id),
    searchTerms: definition.searchTerms,
    section: definition.section,
    shortcut: definition.shortcut,
    variant: definition.variant,
  }));
}

function assertUniqueCommandIds(commands: readonly { id: string }[]): void {
  const ids = new Set<string>();
  for (const { id } of commands) {
    if (ids.has(id)) throw new Error(`Duplicate application command id: ${id}`);
    ids.add(id);
  }
}

function commandsById<Id extends string, T extends { id: Id }>(commands: readonly T[]) {
  assertUniqueCommandIds(commands);
  return Object.fromEntries(commands.map((command) => [command.id, command])) as Record<Id, T>;
}

function normalizeSearchValue(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function getShortcutPlatform(): ShortcutPlatform {
  if (typeof navigator === "undefined") return "other";
  return /Mac/i.test(navigator.userAgent) || /Mac/i.test(navigator.platform) ? "macos" : "other";
}

export {
  assertUniqueCommandIds,
  commandSearchTerms,
  commandsById,
  defineApplicationCommandGroup,
  filterApplicationCommands,
  getShortcutAriaValue,
  getShortcutDisplayKeys,
  isShortcutEvent,
  materializeApplicationCommands,
};

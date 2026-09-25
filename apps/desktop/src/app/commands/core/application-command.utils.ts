import Fuse, { type IFuseOptions } from "fuse.js";

import type {
  ApplicationCommand,
  ApplicationCommandDefinition,
  ApplicationCommandGroup,
  ApplicationCommandGroupMetadata,
  ApplicationCommandMatch,
  ApplicationCommandSurface,
  ApplicationShortcut,
  ShortcutPlatform,
} from "@/app/commands/core/application-command.types";

function defineApplicationCommandGroup<
  const Commands extends readonly ApplicationCommandDefinition[],
>(id: string, label: string, commands: Commands): ApplicationCommandGroup<Commands> {
  return { commands, id, label };
}

function commandSearchTerms(value: string): string[] {
  return value.split("|").map((term) => term.trim());
}

function isApplicationCommandAvailableOnSurface(
  command: Pick<ApplicationCommand, "surfaces">,
  surface: ApplicationCommandSurface,
): boolean {
  return command.surfaces?.includes(surface) ?? true;
}

function filterApplicationCommands<Id extends string>(
  commands: readonly ApplicationCommand<Id>[],
  query: string,
): ApplicationCommandMatch<Id>[] {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) {
    return commands.map((command) => ({
      command,
      groupMatched: false,
      groupMatchRanges: [],
      labelMatched: false,
      labelMatchRanges: [],
      searchTermMatched: false,
    }));
  }

  return new Fuse(commands, commandSearchOptions)
    .search(normalizedQuery)
    .map(({ item: command, matches }) => {
      const labelMatchRanges = matches?.find(({ key }) => key === "label")?.indices ?? [];
      const groupMatchRanges = matches?.find(({ key }) => key === "group.label")?.indices ?? [];
      const searchTermMatched = matches?.some(({ key }) => key === "searchTerms") ?? false;

      return {
        command,
        groupMatched: groupMatchRanges.length > 0,
        groupMatchRanges,
        labelMatched: labelMatchRanges.length > 0,
        labelMatchRanges,
        searchTermMatched,
      };
    });
}

const commandSearchOptions = {
  includeMatches: true,
  ignoreLocation: true,
  keys: ["label", "group.label", "searchTerms"],
  threshold: 0.3,
  tokenMatch: "all",
  useTokenSearch: true,
} satisfies IFuseOptions<ApplicationCommand>;

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
  groups: readonly ApplicationCommandGroup<readonly ApplicationCommandDefinition<Id>[]>[],
  pendingIds: ReadonlySet<Id>,
): ApplicationCommand<Id>[] {
  const definitions = groups.flatMap((group) =>
    group.commands.map((definition) => ({
      definition,
      group: { id: group.id, label: group.label } satisfies ApplicationCommandGroupMetadata,
    })),
  );

  assertUniqueCommandIds(definitions.map(({ definition }) => definition));
  return definitions.map(({ definition, group }) => ({
    checked: definition.checked,
    keepOpen: definition.keepOpen,
    enabled: definition.enabled,
    group,
    icon: definition.icon,
    id: definition.id,
    label: definition.label,
    pending: pendingIds.has(definition.id),
    searchTerms: definition.searchTerms,
    shortcut: definition.shortcut,
    surfaces: definition.surfaces,
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

function getShortcutPlatform(): ShortcutPlatform {
  if (typeof navigator === "undefined") return "other";
  return /Mac/i.test(navigator.userAgent) || /Mac/i.test(navigator.platform) ? "macos" : "other";
}

export {
  assertUniqueCommandIds,
  commandsById,
  commandSearchTerms,
  defineApplicationCommandGroup,
  filterApplicationCommands,
  getShortcutAriaValue,
  getShortcutDisplayKeys,
  isApplicationCommandAvailableOnSurface,
  isShortcutEvent,
  materializeApplicationCommands,
};

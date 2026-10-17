import type {
  ApplicationCommand,
  ApplicationCommandDefinition,
  ApplicationCommandGroup,
  ApplicationCommandGroupMetadata,
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

function getShortcutDisplayKeys(
  shortcut: ApplicationShortcut,
  platform = getShortcutPlatform(),
): readonly string[] {
  const key =
    shortcut.code === "ArrowLeft" || shortcut.key === "LeftArrow"
      ? "←"
      : shortcut.code === "ArrowRight" || shortcut.key === "RightArrow"
        ? "→"
        : shortcut.key;

  if (shortcut.modifier === "none") return shortcut.shift ? ["Shift", key] : [key];

  const modifier =
    shortcut.modifier === "alt"
      ? "Alt"
      : shortcut.modifier === "primary" && platform === "macos"
        ? "Cmd"
        : "Ctrl";

  return shortcut.shift ? [modifier, "Shift", key] : [modifier, key];
}

function getShortcutAriaValue(
  shortcut: ApplicationShortcut,
  platform = getShortcutPlatform(),
): string {
  if (shortcut.modifier === "none") return shortcut.shift ? `Shift+${shortcut.key}` : shortcut.key;

  const modifier =
    shortcut.modifier === "alt"
      ? "Alt"
      : shortcut.modifier === "primary" && platform === "macos"
        ? "Meta"
        : "Control";

  return `${modifier}${shortcut.shift ? "+Shift" : ""}+${shortcut.key}`;
}

function isShortcutEvent(
  event: KeyboardEvent,
  shortcut: ApplicationShortcut,
  platform = getShortcutPlatform(),
): boolean {
  if (shortcut.modifier === "none") {
    return (
      event.key === shortcut.key &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      (shortcut.shift === undefined || event.shiftKey === shortcut.shift)
    );
  }

  const usesMeta = shortcut.modifier === "primary" && platform === "macos";
  const requiredModifierPressed =
    shortcut.modifier === "alt" ? event.altKey : usesMeta ? event.metaKey : event.ctrlKey;

  const otherModifierPressed =
    shortcut.modifier === "alt"
      ? event.ctrlKey || event.metaKey
      : usesMeta
        ? event.ctrlKey
        : event.metaKey;

  const unexpectedAltPressed = shortcut.modifier !== "alt" && event.altKey;

  return (
    event.code === shortcut.code &&
    requiredModifierPressed &&
    !otherModifierPressed &&
    !unexpectedAltPressed &&
    event.shiftKey === (shortcut.shift ?? false)
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
    attention: definition.attention,
    checked: definition.checked,
    keepOpen: definition.keepOpen,
    enabled: definition.enabled,
    group,
    icon: definition.icon,
    id: definition.id,
    label: definition.label,
    pending: pendingIds.has(definition.id),
    preload: definition.preload,
    searchTerms: definition.searchTerms,
    hint: definition.hint,
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
  getShortcutAriaValue,
  getShortcutDisplayKeys,
  isApplicationCommandAvailableOnSurface,
  isShortcutEvent,
  materializeApplicationCommands,
};

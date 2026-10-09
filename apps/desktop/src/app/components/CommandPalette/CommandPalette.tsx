import { createContext, useContext, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { Highlight } from "@/components/ui/highlight";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { MenuIcon } from "@/components/ui/menu";

import type { ApplicationCommandId } from "@/app/commands";
import type {
  ApplicationCommand,
  ApplicationCommandMatch,
} from "@/app/commands/core/application-command.types";
import {
  filterApplicationCommands,
  getShortcutAriaValue,
  getShortcutDisplayKeys,
  isApplicationCommandAvailableOnSurface,
  isShortcutEvent,
} from "@/app/commands/core/application-command.utils";
import { ApplicationCommandIcon } from "@/app/components/ApplicationCommandMenuItem";
import { useCommandPalette } from "@/app/contexts/command-palette-context";
import { useApplicationCommands } from "@/app/hooks/useApplicationCommands";
import type { SearchMatchRange } from "@/domain/search.types";
import { useKeyboardShortcut } from "@/lib/hooks/useKeyboardShortcut";
import { isApplicationInteractionBlocked } from "@/lib/hotkeys.utils";

type CommandPaletteGroupMatches = {
  groupLabel: string;
  groupMatchRanges: ReadonlyArray<SearchMatchRange>;
  matches: ApplicationCommandMatch<ApplicationCommandId>[];
};

function CommandPalette() {
  const { t } = useTranslation();
  const { closeCommandPalette, isCommandPaletteOpen, openCommandPalette, sessionId } =
    useCommandPalette();

  const [queryState, setQueryState] = useState({ sessionId, value: "" });
  const query = queryState.sessionId === sessionId ? queryState.value : "";
  const setQuery = (value: string) => setQueryState({ sessionId, value });
  const { commands, executeCommand: executeApplicationCommand } = useApplicationCommands();
  const paletteCommands = commands.filter((command) =>
    isApplicationCommandAvailableOnSurface(command, "palette"),
  );

  const matches = filterApplicationCommands(paletteCommands, query);
  const groups = groupCommandMatches(matches);

  useKeyboardShortcut(
    (event) =>
      !isCommandPaletteOpen &&
      !isApplicationInteractionBlocked() &&
      commands.some(
        (command) =>
          isApplicationCommandAvailableOnSurface(command, "hotkey") &&
          command.enabled &&
          !command.pending &&
          command.shortcut !== undefined &&
          isShortcutEvent(event, command.shortcut),
      ),
    (event) => {
      const command = commands.find(
        (candidate) =>
          isApplicationCommandAvailableOnSurface(candidate, "hotkey") &&
          candidate.enabled &&
          !candidate.pending &&
          candidate.shortcut !== undefined &&
          isShortcutEvent(event, candidate.shortcut),
      );

      if (command) void executeApplicationCommand(command.id, "hotkey");
    },
    { allowAltModifier: true },
  );

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) openCommandPalette();
    else closeCommandPalette();
    if (!nextOpen) setQuery("");
  }

  function executeCommand(command: ApplicationCommand<ApplicationCommandId>) {
    if (!command.enabled || command.pending) return;
    void executeApplicationCommand(command.id, "palette");
    const keepOpen = command.keepOpen ?? command.checked !== undefined;
    if (!keepOpen) {
      closeCommandPalette();
      setQuery("");
    }
  }

  return (
    <CommandPaletteContext.Provider value={{ executeCommand }}>
      <CommandDialog
        className="top-1/2 h-[min(60dvh,32rem)] -translate-y-1/2 overflow-hidden rounded-xl! p-0 sm:max-w-md"
        description={t("commands.description")}
        onOpenChange={handleOpenChange}
        open={isCommandPaletteOpen}
        title={t("commands.title")}
      >
        <Command label={t("common.search.commands")} shouldFilter={false}>
          <CommandInput
            aria-label={t("common.search.commands")}
            onValueChange={setQuery}
            placeholder={t("common.search.commandsPlaceholder")}
            value={query}
          />
          <CommandList>
            <CommandPaletteEmpty />
            <CommandPaletteContent groups={groups} />
          </CommandList>
        </Command>
      </CommandDialog>
    </CommandPaletteContext.Provider>
  );
}

function CommandPaletteContent({
  groups,
}: {
  groups: Map<ApplicationCommand["group"]["id"], CommandPaletteGroupMatches>;
}) {
  return [...groups.entries()].map(([groupId, group], index) => (
    <div key={groupId}>
      {index > 0 ? <CommandSeparator /> : null}
      <CommandPaletteGroup group={group} />
    </div>
  ));
}

function CommandPaletteEmpty() {
  const { t } = useTranslation();

  return <CommandEmpty>{t("commands.empty")}</CommandEmpty>;
}

function CommandPaletteGroup({ group }: { group: CommandPaletteGroupMatches }) {
  return (
    <div>
      <CommandGroup
        heading={<Highlight ranges={group.groupMatchRanges}>{group.groupLabel}</Highlight>}
      >
        {group.matches.map((match) => (
          <CommandPaletteItem key={match.command.id} match={match} />
        ))}
      </CommandGroup>
    </div>
  );
}

function CommandPaletteItem({ match }: { match: ApplicationCommandMatch<ApplicationCommandId> }) {
  const { command } = match;

  const { executeCommand } = useCommandPaletteState();

  return (
    <CommandItem
      aria-busy={command.pending}
      data-checked={command.checked}
      disabled={!command.enabled || command.pending}
      onSelect={() => executeCommand(command)}
      value={command.id}
      variant={command.variant}
    >
      <MenuIcon>
        <ApplicationCommandIcon command={command} />
      </MenuIcon>
      <span>
        <Highlight ranges={match.labelMatchRanges}>{command.label}</Highlight>
      </span>
      {command.hint ? (
        <CommandShortcut>{command.hint}</CommandShortcut>
      ) : command.shortcut ? (
        <CommandShortcut aria-label={getShortcutAriaValue(command.shortcut)}>
          <KbdGroup>
            {getShortcutDisplayKeys(command.shortcut).map((key) => (
              <Kbd key={key}>{key}</Kbd>
            ))}
          </KbdGroup>
        </CommandShortcut>
      ) : null}
    </CommandItem>
  );
}

const CommandPaletteContext = createContext<{
  executeCommand: (command: ApplicationCommand<ApplicationCommandId>) => void;
} | null>(null);

function useCommandPaletteState() {
  const context = useContext(CommandPaletteContext);
  if (!context) {
    throw new Error("useCommandPaletteState must be used within CommandPalette");
  }
  return context;
}

function groupCommandMatches(matches: readonly ApplicationCommandMatch<ApplicationCommandId>[]) {
  const groups = new Map<ApplicationCommand["group"]["id"], CommandPaletteGroupMatches>();

  for (const match of matches) {
    const current = groups.get(match.command.group.id);
    if (current) {
      current.matches.push(match);
      current.groupMatchRanges = mergeRanges(current.groupMatchRanges, match.groupMatchRanges);
    } else {
      groups.set(match.command.group.id, {
        matches: [match],
        groupLabel: match.command.group.label,
        groupMatchRanges: match.groupMatchRanges,
      });
    }
  }

  return groups;
}

function mergeRanges(
  first: ReadonlyArray<SearchMatchRange>,
  second: ReadonlyArray<SearchMatchRange>,
) {
  return [...first, ...second]
    .filter(
      (range, index, ranges) =>
        ranges.findIndex(([start, end]) => start === range[0] && end === range[1]) === index,
    )
    .sort(([firstStart], [secondStart]) => firstStart - secondStart);
}

export { CommandPalette };

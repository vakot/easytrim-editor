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
import { menuVariantIconClassNames } from "@/components/ui/menu";

import type { ApplicationCommandId } from "@/app/commands";
import { COMMAND_PALETTE_SHORTCUT } from "@/app/commands/core/application-command.shortcuts";
import type {
  ApplicationCommand,
  ApplicationCommandMatch,
  ApplicationCommandVariant,
} from "@/app/commands/core/application-command.types";
import {
  filterApplicationCommands,
  getShortcutAriaValue,
  getShortcutDisplayKeys,
  isApplicationCommandAvailableOnSurface,
  isShortcutEvent,
} from "@/app/commands/core/application-command.utils";
import { ApplicationCommandIcon } from "@/app/components/ApplicationCommandMenuItem";
import { useApplicationCommands } from "@/app/hooks/useApplicationCommands";
import { useKeyboardShortcut } from "@/lib/hooks/useKeyboardShortcut";
import { isApplicationInteractionBlocked } from "@/lib/hotkeys.utils";

const commandVariantClassNames = {
  default: undefined,
  destructive: `text-destructive data-selected:bg-destructive/10 data-selected:text-destructive dark:data-selected:bg-destructive/20 ${menuVariantIconClassNames.destructive}`,
  success: `text-success data-selected:bg-success/10 data-selected:text-success dark:data-selected:bg-success/20 ${menuVariantIconClassNames.success}`,
} satisfies Record<ApplicationCommandVariant, string | undefined>;

type CommandPaletteGroupMatches = {
  groupLabel: string;
  groupMatched: boolean;
  matches: ApplicationCommandMatch<ApplicationCommandId>[];
};

function CommandPalette() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { commands, executeCommand: executeApplicationCommand } = useApplicationCommands();
  const paletteCommands = commands.filter((command) =>
    isApplicationCommandAvailableOnSurface(command, "palette"),
  );

  const matches = filterApplicationCommands(paletteCommands, query);
  const groups = groupCommandMatches(matches);

  useKeyboardShortcut(
    (event) =>
      isShortcutEvent(event, COMMAND_PALETTE_SHORTCUT) &&
      (open || !isApplicationInteractionBlocked()),
    () => setOpen((current) => !current),
    { allowEditableTarget: true },
  );

  useKeyboardShortcut(
    (event) =>
      !open &&
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
  );

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) setQuery("");
  }

  function executeCommand(command: ApplicationCommand<ApplicationCommandId>) {
    if (!command.enabled || command.pending) return;
    void executeApplicationCommand(command.id, "palette");
    const keepOpen = command.keepOpen ?? command.checked !== undefined;
    if (!keepOpen) {
      handleOpenChange(false);
    }
  }

  return (
    <CommandPaletteContext.Provider value={{ query, executeCommand }}>
      <CommandDialog
        className="top-1/2 h-[min(60dvh,32rem)] -translate-y-1/2 overflow-hidden rounded-xl! p-0 sm:max-w-md"
        description={t("app.messages.commandPaletteDescription")}
        onOpenChange={handleOpenChange}
        open={open}
        title={t("app.labels.commandPalette")}
      >
        <Command label={t("app.labels.searchCommands")} shouldFilter={false}>
          <CommandInput
            aria-label={t("app.labels.searchCommands")}
            onValueChange={setQuery}
            placeholder={t("app.messages.commandPalettePlaceholder")}
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

  return <CommandEmpty>{t("app.messages.commandPaletteEmpty")}</CommandEmpty>;
}

function CommandPaletteGroup({ group }: { group: CommandPaletteGroupMatches }) {
  const { query } = useCommandPaletteState();

  return (
    <div>
      <CommandGroup
        heading={<Highlight query={group.groupMatched ? query : ""}>{group.groupLabel}</Highlight>}
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

  const { executeCommand, query } = useCommandPaletteState();

  return (
    <CommandItem
      aria-busy={command.pending}
      className={commandVariantClassNames[command.variant]}
      data-checked={command.checked}
      disabled={!command.enabled || command.pending}
      onSelect={() => executeCommand(command)}
      value={command.id}
    >
      <ApplicationCommandIcon command={command} />
      <span>
        <Highlight query={match.labelMatched ? query : ""}>{command.label}</Highlight>
      </span>
      {command.shortcut ? (
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
  query: string;
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
      current.groupMatched ||= match.groupMatched;
    } else {
      groups.set(match.command.group.id, {
        matches: [match],
        groupLabel: match.command.group.label,
        groupMatched: match.groupMatched,
      });
    }
  }

  return groups;
}

export { CommandPalette };

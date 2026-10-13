import { SearchIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandInputGroup,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import type { DialogScope } from "@/components/ui/dialog";
import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Highlight } from "@/components/ui/highlight";
import { InputGroupAddon } from "@/components/ui/input-group";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { MenuIcon } from "@/components/ui/menu";

import type { ApplicationCommandId } from "@/app/commands";
import type {
  ApplicationCommand,
  ApplicationCommandMatch,
} from "@/app/commands/core/application-command.types";
import {
  getShortcutAriaValue,
  getShortcutDisplayKeys,
} from "@/app/commands/core/application-command.utils";
import { filterApplicationCommands } from "@/app/commands/core/application-command-search.utils";
import { ApplicationCommandIcon } from "@/app/components/ApplicationCommandMenuItem";
import type { SearchMatchRange } from "@/domain/search.types";

type CommandPaletteGroupMatches = {
  groupLabel: string;
  groupMatchRanges: ReadonlyArray<SearchMatchRange>;
  matches: ApplicationCommandMatch<ApplicationCommandId>[];
};

interface AppCommandPaletteDialogContentProps {
  __scopeDialog?: DialogScope;
  commands: readonly ApplicationCommand<ApplicationCommandId>[];
  executeCommand: (command: ApplicationCommand<ApplicationCommandId>) => void;
}

function AppCommandPaletteDialogContent({
  __scopeDialog,
  commands,
  executeCommand,
}: AppCommandPaletteDialogContentProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const matches = filterApplicationCommands(commands, query);
  const groups = groupCommandMatches(matches);

  return (
    <>
      <DialogHeader className="sr-only">
        <DialogTitle __scopeDialog={__scopeDialog}>{t("commands.title")}</DialogTitle>
        <DialogDescription __scopeDialog={__scopeDialog}>
          {t("commands.description")}
        </DialogDescription>
      </DialogHeader>
      <Command label={t("common.search.commands")} shouldFilter={false}>
        <CommandInputGroup>
          <CommandInput
            aria-label={t("common.search.commands")}
            autoFocus
            onValueChange={setQuery}
            placeholder={t("common.search.commandsPlaceholder")}
            value={query}
          />
          <InputGroupAddon>
            <SearchIcon className="text-muted-foreground" />
          </InputGroupAddon>
        </CommandInputGroup>
        <CommandList>
          <CommandEmpty>{t("commands.empty")}</CommandEmpty>
          {[...groups.entries()].map(([groupId, group], index) => (
            <div key={groupId}>
              {index > 0 ? <CommandSeparator /> : null}
              <CommandGroup
                heading={<Highlight ranges={group.groupMatchRanges}>{group.groupLabel}</Highlight>}
              >
                {group.matches.map((match) => (
                  <AppCommandPaletteItem
                    executeCommand={executeCommand}
                    key={match.command.id}
                    match={match}
                  />
                ))}
              </CommandGroup>
            </div>
          ))}
        </CommandList>
      </Command>
    </>
  );
}

function AppCommandPaletteItem({
  executeCommand,
  match,
}: {
  executeCommand: AppCommandPaletteDialogContentProps["executeCommand"];
  match: ApplicationCommandMatch<ApplicationCommandId>;
}) {
  const { command } = match;

  return (
    <CommandItem
      aria-busy={command.pending}
      data-checked={command.checked}
      disabled={!command.enabled || command.pending}
      onFocus={command.preload}
      onPointerEnter={command.preload}
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

export { AppCommandPaletteDialogContent };
export type { AppCommandPaletteDialogContentProps };

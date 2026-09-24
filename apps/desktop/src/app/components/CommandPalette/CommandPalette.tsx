import {
  FileInputIcon,
  FileOutputIcon,
  FolderOpenIcon,
  ScissorsIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { createContext, useCallback, useContext, useState } from "react";
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

import {
  APPLICATION_SHORTCUTS,
  type ApplicationCommand,
  type ApplicationCommandId,
  type ApplicationCommandMatch,
  filterApplicationCommands,
  getShortcutAriaValue,
  getShortcutDisplayKeys,
  isShortcutEvent,
} from "@/app/commands/application-commands";
import { useApplicationCommands } from "@/app/hooks/useApplicationCommands";
import { SourceDeleteDialog } from "@/features/source";
import { useKeyboardShortcut } from "@/lib/hooks/useKeyboardShortcut";
import { isApplicationInteractionBlocked } from "@/lib/hotkeys.utils";

const commandIcons = {
  "close-file": XIcon,
  "delete-file": Trash2Icon,
  "open-file": FileInputIcon,
  "open-folder": FolderOpenIcon,
  "optimized-export": FileOutputIcon,
  "save-lossless-cut": ScissorsIcon,
} satisfies Record<ApplicationCommandId, typeof XIcon>;

type CommandPaletteSection = {
  matches: ApplicationCommandMatch[];
  sectionLabel: string;
  sectionMatched: boolean;
};

function CommandPalette() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [deleteSourceId, setDeleteSourceId] = useState<string | null>(null);
  const requestDelete = useCallback((sourceId: string) => setDeleteSourceId(sourceId), []);
  const commands = useApplicationCommands(requestDelete);
  const matches = filterApplicationCommands(commands, query);
  const groups = groupCommandMatches(matches);

  useKeyboardShortcut(
    (event) =>
      isShortcutEvent(event, APPLICATION_SHORTCUTS.commandPalette) &&
      (open || !isApplicationInteractionBlocked()),
    () => setOpen((current) => !current),
    { allowEditableTarget: true },
  );

  useKeyboardShortcut(
    (event) =>
      !open &&
      commands.some(
        (command) =>
          command.enabled &&
          command.shortcut !== undefined &&
          isShortcutEvent(event, command.shortcut),
      ),
    (event) => {
      const command = commands.find(
        (candidate) =>
          candidate.enabled &&
          candidate.shortcut !== undefined &&
          isShortcutEvent(event, candidate.shortcut),
      );

      command?.execute("hotkey");
    },
  );

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) setQuery("");
  }

  function executeCommand(command: ApplicationCommand) {
    if (!command.enabled) return;
    handleOpenChange(false);
    command.execute("palette");
  }

  return (
    <CommandPaletteContext.Provider value={{ query, executeCommand }}>
      <CommandDialog
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

      <SourceDeleteDialog
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setDeleteSourceId(null);
        }}
        open={deleteSourceId !== null}
        sourceId={deleteSourceId}
      >
        {null}
      </SourceDeleteDialog>
    </CommandPaletteContext.Provider>
  );
}

function CommandPaletteContent({
  groups,
}: {
  groups: Map<ApplicationCommand["section"]["id"], CommandPaletteSection>;
}) {
  return [...groups.entries()].map(([sectionId, group], index) => (
    <div key={sectionId}>
      {index > 0 ? <CommandSeparator /> : null}
      <CommandPaletteGroup group={group} />
    </div>
  ));
}

function CommandPaletteEmpty() {
  const { t } = useTranslation();

  return <CommandEmpty>{t("app.messages.commandPaletteEmpty")}</CommandEmpty>;
}

function CommandPaletteGroup({ group }: { group: CommandPaletteSection }) {
  const { query } = useCommandPaletteState();

  return (
    <div>
      <CommandGroup
        heading={
          <Highlight query={group.sectionMatched ? query : ""}>{group.sectionLabel}</Highlight>
        }
      >
        {group.matches.map((match) => (
          <CommandPaletteItem key={match.command.id} match={match} />
        ))}
      </CommandGroup>
    </div>
  );
}

function CommandPaletteItem({ match }: { match: ApplicationCommandMatch }) {
  const { command } = match;
  const Icon = commandIcons[command.id];

  const { executeCommand, query } = useCommandPaletteState();

  return (
    <CommandItem
      disabled={!command.enabled}
      onSelect={() => executeCommand(command)}
      value={command.id}
    >
      <Icon aria-hidden="true" />
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
  executeCommand: (command: ApplicationCommand) => void;
  query: string;
} | null>(null);

function useCommandPaletteState() {
  const context = useContext(CommandPaletteContext);
  if (!context) {
    throw new Error("useCommandPaletteState must be used within CommandPalette");
  }
  return context;
}

function groupCommandMatches(matches: readonly ApplicationCommandMatch[]) {
  const groups = new Map<ApplicationCommand["section"]["id"], CommandPaletteSection>();

  for (const match of matches) {
    const current = groups.get(match.command.section.id);
    if (current) {
      current.matches.push(match);
      current.sectionMatched ||= match.sectionMatched;
    } else {
      groups.set(match.command.section.id, {
        matches: [match],
        sectionLabel: match.command.section.label,
        sectionMatched: match.sectionMatched,
      });
    }
  }

  return groups;
}

export { CommandPalette };

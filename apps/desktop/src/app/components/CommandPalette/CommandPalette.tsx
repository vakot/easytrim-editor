import {
  BetweenVerticalStart,
  CheckCircle2,
  CircleAlert,
  Download,
  ExternalLink,
  FileInputIcon,
  FileOutputIcon,
  FolderInput,
  FolderOpenIcon,
  LoaderCircle,
  Magnet,
  Merge,
  Monitor,
  Moon,
  Play,
  RefreshCw,
  Repeat,
  RotateCcw,
  ScissorsIcon,
  ScrollText,
  Sun,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import type { ComponentType } from "react";
import { createContext, createElement, useContext, useState } from "react";
import { useTranslation } from "react-i18next";

import { ColorSample } from "@/components/ui/color";
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
  type ApplicationCommandVariant,
  filterApplicationCommands,
  getShortcutAriaValue,
  getShortcutDisplayKeys,
  isShortcutEvent,
} from "@/app/commands/application-commands";
import { useApplicationCommands } from "@/app/hooks/useApplicationCommands";
import { resolvePrimaryColor } from "@/app/theme/theme";
import { GithubIcon, KofiIcon } from "@/components/brand-icons";
import { useKeyboardShortcut } from "@/lib/hooks/useKeyboardShortcut";
import { isApplicationInteractionBlocked } from "@/lib/hotkeys.utils";

type CommandIcon = ComponentType<{ "aria-hidden"?: boolean | "true" | "false" }>;

const primaryColorIcons = {
  amber: ({ "aria-hidden": ariaHidden }: { "aria-hidden"?: boolean | "true" | "false" }) => (
    <ColorSample aria-hidden={ariaHidden} color={resolvePrimaryColor("amber")} />
  ),
  blue: ({ "aria-hidden": ariaHidden }: { "aria-hidden"?: boolean | "true" | "false" }) => (
    <ColorSample aria-hidden={ariaHidden} color={resolvePrimaryColor("blue")} />
  ),
  emerald: ({ "aria-hidden": ariaHidden }: { "aria-hidden"?: boolean | "true" | "false" }) => (
    <ColorSample aria-hidden={ariaHidden} color={resolvePrimaryColor("emerald")} />
  ),
  rose: ({ "aria-hidden": ariaHidden }: { "aria-hidden"?: boolean | "true" | "false" }) => (
    <ColorSample aria-hidden={ariaHidden} color={resolvePrimaryColor("rose")} />
  ),
  violet: ({ "aria-hidden": ariaHidden }: { "aria-hidden"?: boolean | "true" | "false" }) => (
    <ColorSample aria-hidden={ariaHidden} color={resolvePrimaryColor("violet")} />
  ),
} satisfies Record<string, CommandIcon>;

const commandIcons: Record<ApplicationCommandId, CommandIcon> = {
  "activity-feed-view-branch": FileOutputIcon,
  "activity-feed-view-compact": FileOutputIcon,
  "activity-feed-view-default": FileOutputIcon,
  "check-for-updates": RefreshCw,
  "close-file": XIcon,
  "crop-preview": ScissorsIcon,
  "delete-source-on-render-finish": Trash2Icon,
  "delete-file": Trash2Icon,
  "flip-horizontal": ScissorsIcon,
  "flip-vertical": ScissorsIcon,
  "language-en": FileOutputIcon,
  "language-ru": FileOutputIcon,
  "language-sk": FileOutputIcon,
  "layout-density-compact": FileOutputIcon,
  "layout-density-default": FileOutputIcon,
  "open-changelog": ScrollText,
  "open-file": FileInputIcon,
  "open-folder": FolderOpenIcon,
  "open-project-page": GithubIcon,
  "open-release-page": ExternalLink,
  "optimized-export": FileOutputIcon,
  "preference-auto-start-queue": Play,
  "preference-loop-playback": Repeat,
  "preference-merge-audio": Merge,
  "preference-segment-playback": BetweenVerticalStart,
  "preference-snap-playback": Magnet,
  "primary-color-amber": primaryColorIcons.amber,
  "primary-color-blue": primaryColorIcons.blue,
  "primary-color-emerald": primaryColorIcons.emerald,
  "primary-color-rose": primaryColorIcons.rose,
  "primary-color-violet": primaryColorIcons.violet,
  "queue-finish-exit": FileOutputIcon,
  "queue-finish-nothing": FileOutputIcon,
  "queue-finish-system-shutdown": FileOutputIcon,
  "queue-finish-system-sleep": FileOutputIcon,
  "reset-layout": FileOutputIcon,
  "reset-preferences": RotateCcw,
  "reset-transform": XIcon,
  "rotate-180": ScissorsIcon,
  "rotate-90-ccw": ScissorsIcon,
  "rotate-90-cw": ScissorsIcon,
  "save-lossless-cut": ScissorsIcon,
  "show-logs": FolderInput,
  "support-project": KofiIcon,
  "theme-dark": Moon,
  "theme-light": Sun,
  "theme-system": Monitor,
  "toggle-bottom-panel": FileOutputIcon,
  "toggle-left-panel": FileOutputIcon,
};

const CheckingIcon: CommandIcon = ({ "aria-hidden": ariaHidden }) => (
  <LoaderCircle aria-hidden={ariaHidden} className="animate-spin" />
);

function getCommandIcon(
  command: ApplicationCommand,
  updateLabels: { checking: string; update: string },
): CommandIcon {
  if (command.id !== "check-for-updates") return commandIcons[command.id];
  if (command.variant === "success") return CheckCircle2;
  if (command.variant === "destructive") return CircleAlert;
  if (command.label === updateLabels.update) return Download;
  if (command.label === updateLabels.checking) return CheckingIcon;
  return RefreshCw;
}

const commandVariantClassNames = {
  default: undefined,
  destructive:
    "text-destructive data-selected:bg-destructive/10 data-selected:text-destructive dark:data-selected:bg-destructive/20",
  success:
    "text-success data-selected:bg-success/10 data-selected:text-success dark:data-selected:bg-success/20",
} satisfies Record<ApplicationCommandVariant, string | undefined>;

type CommandPaletteSection = {
  matches: ApplicationCommandMatch[];
  sectionLabel: string;
  sectionMatched: boolean;
};

function CommandPalette() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { commands, executeCommand: executeApplicationCommand } = useApplicationCommands();
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
          !command.pending &&
          command.shortcut !== undefined &&
          isShortcutEvent(event, command.shortcut),
      ),
    (event) => {
      const command = commands.find(
        (candidate) =>
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

  function executeCommand(command: ApplicationCommand) {
    if (!command.enabled || command.pending) return;
    handleOpenChange(false);
    void executeApplicationCommand(command.id, "palette");
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
  const { t } = useTranslation();
  const Icon = getCommandIcon(command, {
    checking: t("app.status.checkingForUpdates"),
    update: t("app.actions.update"),
  });

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
      {createElement(Icon, { "aria-hidden": "true" })}
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

import type { ReactNode } from "react";

import type { DiagnosticOrigin } from "@/lib/tauri/diagnostics.types";

type ApplicationCommandSurface = "button" | "hotkey" | "menu" | "palette";
type ApplicationCommandVariant = "default" | "destructive" | "success";
type MaybePromise<T> = T | Promise<T>;
type ShortcutPlatform = "macos" | "other";

interface ApplicationShortcut {
  code: string;
  key: string;
  modifier: "control" | "primary";
}

interface ApplicationCommandGroupMetadata {
  id: string;
  label: string;
}

interface ApplicationCommand<Id extends string = string> {
  checked?: boolean;
  /** Overrides the default palette dismissal behavior based on whether this command is checked. */
  closePaletteOnSelect?: boolean;
  enabled: boolean;
  group: ApplicationCommandGroupMetadata;
  icon: ReactNode;
  id: Id;
  label: string;
  pending: boolean;
  searchTerms: readonly string[];
  shortcut?: ApplicationShortcut;
  variant: ApplicationCommandVariant;
}

interface ApplicationCommandExecutionContext {
  surface: ApplicationCommandSurface;
}

interface ApplicationCommandDefinition<Id extends string = string> extends Omit<
  ApplicationCommand<Id>,
  "group" | "pending"
> {
  run: (context: ApplicationCommandExecutionContext) => MaybePromise<void>;
}

interface ApplicationCommandGroup<
  Commands extends readonly ApplicationCommandDefinition[] =
    readonly ApplicationCommandDefinition[],
> {
  commands: Commands;
  id: string;
  label: string;
}

interface ApplicationCommandMatch<Id extends string = string> {
  command: ApplicationCommand<Id>;
  groupMatched: boolean;
  labelMatched: boolean;
  searchTermMatched: boolean;
}

function commandOrigin(commandId: string, surface: ApplicationCommandSurface) {
  const type: DiagnosticOrigin["type"] =
    surface === "hotkey" ? "hotkey" : surface === "button" ? "button" : "menu";

  return { id: `${surface}.${commandId}`, type } satisfies DiagnosticOrigin;
}

export type {
  ApplicationCommand,
  ApplicationCommandDefinition,
  ApplicationCommandExecutionContext,
  ApplicationCommandGroup,
  ApplicationCommandGroupMetadata,
  ApplicationCommandMatch,
  ApplicationCommandSurface,
  ApplicationCommandVariant,
  ApplicationShortcut,
  ShortcutPlatform,
};
export { commandOrigin };

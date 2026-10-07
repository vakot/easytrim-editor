import type { ApplicationShortcut } from "@/app/commands/core/application-command.types";

const COMMAND_PALETTE_SHORTCUT = {
  code: "Slash",
  key: "/",
  modifier: "none",
} as const satisfies ApplicationShortcut;

const SETTINGS_SHORTCUT = {
  code: "KeyH",
  key: "H",
  modifier: "control",
} as const satisfies ApplicationShortcut;

export { COMMAND_PALETTE_SHORTCUT, SETTINGS_SHORTCUT };

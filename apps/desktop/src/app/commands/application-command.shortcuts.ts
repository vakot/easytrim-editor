import type { ApplicationShortcut } from "@/app/commands/application-command.types";

const COMMAND_PALETTE_SHORTCUT = {
  code: "KeyH",
  key: "H",
  modifier: "primary",
} as const satisfies ApplicationShortcut;

export { COMMAND_PALETTE_SHORTCUT };

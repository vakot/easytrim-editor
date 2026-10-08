import type { ApplicationShortcut } from "../core/application-command.types";

const FAST_EXPORT_SHORTCUT = {
  code: "KeyS",
  key: "S",
  modifier: "control",
} as const satisfies ApplicationShortcut;

const OPTIMIZED_EXPORT_SHORTCUT = {
  code: "KeyE",
  key: "E",
  modifier: "control",
} as const satisfies ApplicationShortcut;

export { FAST_EXPORT_SHORTCUT, OPTIMIZED_EXPORT_SHORTCUT };

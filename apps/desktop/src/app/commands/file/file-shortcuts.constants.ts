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

const GIF_EXPORT_SHORTCUT = {
  code: "KeyG",
  key: "G",
  modifier: "control",
  shift: true,
} as const satisfies ApplicationShortcut;

const AUDIO_EXPORT_SHORTCUT = {
  code: "KeyA",
  key: "A",
  modifier: "control",
  shift: true,
} as const satisfies ApplicationShortcut;

export {
  AUDIO_EXPORT_SHORTCUT,
  FAST_EXPORT_SHORTCUT,
  GIF_EXPORT_SHORTCUT,
  OPTIMIZED_EXPORT_SHORTCUT,
};

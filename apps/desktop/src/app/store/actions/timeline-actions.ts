import { createAction } from "@reduxjs/toolkit";

/** A timeline keyboard shortcut completed its action successfully. */
const timelineShortcutExecuted = createAction("timeline/shortcut-executed");

export { timelineShortcutExecuted };

import { afterEach, describe, expect, it } from "vitest";

import { isApplicationInteractionBlocked, isPlaybackShortcutBlocked } from "../hotkeys.utils";

function openDialog(attributes: Record<string, string> = {}) {
  const dialog = document.createElement("div");
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("data-state", "open");
  for (const [name, value] of Object.entries(attributes)) dialog.setAttribute(name, value);
  document.body.append(dialog);
  return dialog;
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("playback shortcuts", () => {
  it("are blocked by open surfaces unless the surface keeps playback controllable", () => {
    expect(isPlaybackShortcutBlocked(document.body)).toBe(false);

    const filters = openDialog({ "data-playback-shortcuts": "" });
    expect(isApplicationInteractionBlocked()).toBe(true);
    expect(isPlaybackShortcutBlocked(filters)).toBe(false);

    const menu = document.createElement("div");
    menu.setAttribute("role", "menu");
    menu.setAttribute("data-state", "open");
    document.body.append(menu);
    expect(isPlaybackShortcutBlocked(filters)).toBe(true);
    menu.remove();

    openDialog();
    expect(isPlaybackShortcutBlocked(filters)).toBe(true);
  });

  it("leave Space and arrow keys to the control focused inside such a surface", () => {
    const filters = openDialog({ "data-playback-shortcuts": "" });
    const toggle = document.createElement("button");
    toggle.setAttribute("role", "switch");
    const slider = document.createElement("span");
    slider.setAttribute("role", "slider");
    filters.append(toggle, slider);

    expect(isPlaybackShortcutBlocked(toggle)).toBe(true);
    expect(isPlaybackShortcutBlocked(slider)).toBe(false);
  });
});

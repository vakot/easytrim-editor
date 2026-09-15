import { afterEach, describe, expect, it } from "vitest";

import {
  editorShortcutFromEvent,
  type ShortcutDisposition,
  shortcutDispositionFromEvent,
} from "../editor-shortcuts";

const shortcutCases = [
  ["Space", " "],
  ["ArrowLeft", "ArrowLeft"],
  ["ArrowRight", "ArrowRight"],
  ["KeyI", "i"],
  ["KeyO", "o"],
] as const;

function dispositionFor(
  element: HTMLElement,
  code: string,
  key: string = code,
): ShortcutDisposition {
  let disposition: ShortcutDisposition | undefined;
  element.addEventListener("keydown", (event) => {
    disposition = shortcutDispositionFromEvent(event);
  });
  element.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, code, key }));
  return disposition ?? "ignored";
}

function appendElement(tagName = "div", attributes: Record<string, string> = {}) {
  const element = document.createElement(tagName);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  document.body.append(element);
  return element;
}

afterEach(() => document.body.replaceChildren());

describe("editor shortcut ownership", () => {
  it("lets timeline sliders own arrows while the global handler owns Space and I/O", () => {
    const slider = appendElement("button", { "data-editor-keyboard": "timeline-slider" });

    expect(dispositionFor(slider, "ArrowLeft")).toBe("local-control");
    expect(dispositionFor(slider, "ArrowRight")).toBe("local-control");
    expect(dispositionFor(slider, "Space", " ")).toBe("timeline");
    expect(dispositionFor(slider, "KeyI", "i")).toBe("timeline");
    expect(dispositionFor(slider, "KeyO", "o")).toBe("timeline");
  });

  it("lets timeline transport controls own every timeline shortcut", () => {
    const transport = appendElement("button", { "data-editor-keyboard": "timeline-transport" });

    for (const [code, key] of shortcutCases) {
      expect(dispositionFor(transport, code, key)).toBe("timeline");
    }
  });

  it("preserves text editing and native range behavior", () => {
    const input = appendElement("input");
    const textarea = appendElement("textarea");
    const contenteditable = appendElement("div", { contenteditable: "true" });
    const range = appendElement("input", { type: "range" });
    const customSlider = appendElement("div", { role: "slider" });

    for (const [code, key] of shortcutCases) {
      expect(dispositionFor(input, code, key)).toBe("native");
      expect(dispositionFor(textarea, code, key)).toBe("native");
      expect(dispositionFor(contenteditable, code, key)).toBe("native");
    }
    expect(dispositionFor(range, "ArrowLeft")).toBe("native");
    expect(dispositionFor(range, "ArrowRight")).toBe("native");
    expect(dispositionFor(customSlider, "ArrowLeft")).toBe("native");
    expect(dispositionFor(customSlider, "ArrowRight")).toBe("native");
    expect(dispositionFor(customSlider, "Space", " ")).toBe("native");
    expect(dispositionFor(customSlider, "KeyI", "i")).toBe("native");
    expect(dispositionFor(customSlider, "KeyO", "o")).toBe("native");
  });

  it("preserves composite widget keyboard behavior", () => {
    const roles = [
      "menu",
      "combobox",
      "listbox",
      "menuitem",
      "tab",
      "tablist",
      "dialog",
      "spinbutton",
      "switch",
      "toolbar",
      "treeitem",
    ];

    for (const role of roles) {
      const widget = appendElement("div", { role });
      expect(dispositionFor(widget, "Space", " ")).toBe("native");
      expect(dispositionFor(widget, "ArrowLeft")).toBe("native");
      expect(dispositionFor(widget, "ArrowRight")).toBe("native");
      expect(dispositionFor(widget, "KeyI", "i")).toBe("native");
      expect(dispositionFor(widget, "KeyO", "o")).toBe("native");
    }
  });

  it("keeps Space native for ordinary buttons and assigns arrows and I/O globally", () => {
    const button = appendElement("button");
    const customButton = appendElement("div", { role: "button" });

    expect(dispositionFor(button, "Space", " ")).toBe("native");
    expect(dispositionFor(customButton, "Space", " ")).toBe("native");
    expect(dispositionFor(button, "ArrowLeft")).toBe("timeline");
    expect(dispositionFor(button, "ArrowRight")).toBe("timeline");
    expect(dispositionFor(button, "KeyI", "i")).toBe("timeline");
    expect(dispositionFor(button, "KeyO", "o")).toBe("timeline");
  });

  it("uses event.code and ignores modified or unknown keys", () => {
    const neutral = appendElement();
    expect(dispositionFor(neutral, "KeyI", "x")).toBe("timeline");
    expect(
      editorShortcutFromEvent(new KeyboardEvent("keydown", { code: "KeyI", ctrlKey: true })),
    ).toBe(null);
    expect(
      editorShortcutFromEvent(new KeyboardEvent("keydown", { code: "KeyI", altKey: true })),
    ).toBe(null);
    expect(
      editorShortcutFromEvent(new KeyboardEvent("keydown", { code: "KeyI", metaKey: true })),
    ).toBe(null);
    expect(dispositionFor(neutral, "KeyI", "i")).toBe("timeline");
  });
});

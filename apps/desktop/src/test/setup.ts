import "@testing-library/jest-dom/vitest";

// JSDOM does not load media. Treat rendered media elements as playable unless a
// test overrides readiness to exercise loading behavior explicitly.
Object.defineProperty(HTMLMediaElement.prototype, "readyState", {
  configurable: true,
  get: () => HTMLMediaElement.HAVE_FUTURE_DATA,
});
import "@/i18n/config";

import { cleanup, configure } from "@testing-library/react";
import { afterEach } from "vitest";

class ResizeObserverMock implements ResizeObserver {
  disconnect() {}

  observe() {}

  unobserve() {}
}

window.ResizeObserver = ResizeObserverMock;
class PointerEventMock extends MouseEvent {
  readonly isPrimary: boolean;
  readonly pointerId: number;

  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init);
    this.isPrimary = init.isPrimary ?? true;
    this.pointerId = init.pointerId ?? 0;
  }
}

Object.defineProperty(window, "PointerEvent", {
  configurable: true,
  value: PointerEventMock,
});
Element.prototype.hasPointerCapture = () => true;
Element.prototype.setPointerCapture = () => undefined;
Element.prototype.releasePointerCapture = () => undefined;

// JSDOM has no matchMedia; report that no media query matches unless a test stubs it.
window.matchMedia ??= (query: string): MediaQueryList => ({
  addEventListener: () => undefined,
  addListener: () => undefined,
  dispatchEvent: () => false,
  matches: false,
  media: query,
  onchange: null,
  removeEventListener: () => undefined,
  removeListener: () => undefined,
});

// JSDOM has no Web Animations API; drag-and-drop measurement asks for running animations.
for (const target of [document, Element.prototype]) {
  Object.defineProperty(target, "getAnimations", { configurable: true, value: () => [] });
}
Element.prototype.scrollIntoView = () => undefined;

// Lazily loaded UI can take longer than the 1s default while the full suite runs in parallel.
configure({ asyncUtilTimeout: 4000 });

afterEach(cleanup);

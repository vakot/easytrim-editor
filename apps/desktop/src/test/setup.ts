import "@testing-library/jest-dom/vitest";

// JSDOM does not load media. Treat rendered media elements as playable unless a
// test overrides readiness to exercise loading behavior explicitly.
Object.defineProperty(HTMLMediaElement.prototype, "readyState", {
  configurable: true,
  get: () => HTMLMediaElement.HAVE_FUTURE_DATA,
});
import "@/i18n/config";

import { cleanup } from "@testing-library/react";
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
Element.prototype.scrollIntoView = () => undefined;

afterEach(cleanup);

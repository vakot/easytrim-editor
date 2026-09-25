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
Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
  configurable: true,
  get() {
    return this.matches("[data-slot='scroll-area-viewport'], [data-slot='tabs-content']") ? 600 : 0;
  },
});
Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
  configurable: true,
  get() {
    return this.matches("[data-slot='scroll-area-viewport'], [data-slot='tabs-content']") ? 900 : 0;
  },
});
Element.prototype.hasPointerCapture = () => true;
Element.prototype.setPointerCapture = () => undefined;
Element.prototype.releasePointerCapture = () => undefined;
Element.prototype.scrollIntoView = () => undefined;

afterEach(cleanup);

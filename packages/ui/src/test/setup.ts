import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// JSDOM has no ResizeObserver; Radix measures popper content with it.
class ResizeObserverMock implements ResizeObserver {
  disconnect() {}

  observe() {}

  unobserve() {}
}

window.ResizeObserver = ResizeObserverMock;

afterEach(cleanup);

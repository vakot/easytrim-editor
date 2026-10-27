import { vi } from "vitest";

/** A controllable IntersectionObserver: nothing is seen until a test calls `show`. */
class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = [];

  readonly observed = new Set<Element>();
  readonly unobserve = vi.fn((element: Element) => {
    this.observed.delete(element);
  });

  constructor(
    private readonly callback: IntersectionObserverCallback,
    readonly options?: IntersectionObserverInit,
  ) {
    MockIntersectionObserver.instances.push(this);
  }

  disconnect() {
    this.observed.clear();
  }

  observe(element: Element) {
    this.observed.add(element);
  }

  /** Reports the given elements, in the given order, as entering or leaving the viewport. */
  show(elements: Element[], isIntersecting = true) {
    this.callback(
      elements.map((target) => ({ isIntersecting, target }) as IntersectionObserverEntry),
      this as unknown as IntersectionObserver,
    );
  }
}

function stubIntersectionObserver() {
  MockIntersectionObserver.instances = [];
  vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
  return MockIntersectionObserver;
}

export { stubIntersectionObserver };

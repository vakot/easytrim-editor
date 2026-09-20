import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { InfiniteScroll } from "../infinite-scroll";

type ObserverCallback = (entries: Array<{ isIntersecting: boolean }>) => void;

interface ObserverOptions {
  root: Element | null;
  rootMargin?: string;
}

class IntersectionObserverMock {
  static instances: IntersectionObserverMock[] = [];

  readonly callback: ObserverCallback;
  readonly options: ObserverOptions;

  constructor(callback: ObserverCallback, options: ObserverOptions) {
    this.callback = callback;
    this.options = options;
    IntersectionObserverMock.instances.push(this);
  }

  disconnect() {}

  observe() {}

  trigger(isIntersecting: boolean) {
    this.callback([{ isIntersecting }]);
  }
}

beforeEach(() => {
  IntersectionObserverMock.instances = [];
  vi.stubGlobal("IntersectionObserver", IntersectionObserverMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("InfiniteScroll", () => {
  it("replays a sentinel intersection captured while loading", () => {
    const next = vi.fn();
    const { rerender } = render(
      <InfiniteScroll hasMore isLoading next={next}>
        Items
      </InfiniteScroll>,
    );

    IntersectionObserverMock.instances[0]?.trigger(true);
    expect(next).not.toHaveBeenCalled();

    rerender(
      <InfiniteScroll hasMore isLoading={false} next={next}>
        Items
      </InfiniteScroll>,
    );

    expect(next).toHaveBeenCalledOnce();
  });

  it("allows only one request while a batch is loading", () => {
    const next = vi.fn();
    const { rerender } = render(
      <InfiniteScroll hasMore isLoading={false} next={next}>
        Items
      </InfiniteScroll>,
    );

    const observer = IntersectionObserverMock.instances[0];
    observer?.trigger(true);
    expect(next).toHaveBeenCalledOnce();

    rerender(
      <InfiniteScroll hasMore isLoading next={next}>
        Items
      </InfiniteScroll>,
    );
    observer?.trigger(true);
    expect(next).toHaveBeenCalledOnce();

    rerender(
      <InfiniteScroll hasMore isLoading={false} next={next}>
        Items
      </InfiniteScroll>,
    );

    expect(next).toHaveBeenCalledTimes(2);
  });

  it("does not request the same batch more than once before loading starts", () => {
    const next = vi.fn();
    render(
      <InfiniteScroll hasMore isLoading={false} next={next}>
        Items
      </InfiniteScroll>,
    );

    const observer = IntersectionObserverMock.instances[0];
    observer?.trigger(true);
    observer?.trigger(true);

    expect(next).toHaveBeenCalledOnce();
  });

  it("allows the next request after the sentinel leaves and re-enters", () => {
    const next = vi.fn();
    render(
      <InfiniteScroll hasMore isLoading={false} next={next}>
        Items
      </InfiniteScroll>,
    );

    const observer = IntersectionObserverMock.instances[0];
    observer?.trigger(true);
    observer?.trigger(false);
    observer?.trigger(true);

    expect(next).toHaveBeenCalledTimes(2);
  });

  it("uses the nearest scroll area viewport as the observer root", () => {
    const next = vi.fn();
    const { container } = render(
      <div data-slot="scroll-area-viewport">
        <InfiniteScroll hasMore next={next}>
          Items
        </InfiniteScroll>
      </div>,
    );

    expect(IntersectionObserverMock.instances[0]?.options.root).toBe(container.firstChild);
  });
});

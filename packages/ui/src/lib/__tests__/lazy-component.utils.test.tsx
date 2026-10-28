import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Suspense, useEffect, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { lazyWithPreload, preloadOnIntent } from "../lazy-component.utils";

describe("lazyWithPreload", () => {
  it("does not mount closed content and reuses the preloaded module on intent", async () => {
    const loader = vi.fn(async () => ({ default: IntentContent }));
    const LazyContent = lazyWithPreload<Record<string, never>>(loader);
    const preloadContent = preloadOnIntent(() => LazyContent.preload());

    function Harness() {
      const [open, setOpen] = useState(false);
      const [count, setCount] = useState(0);
      useEffect(() => {
        runtimeMount();
        return runtimeCleanup;
      }, []);

      return (
        <>
          <button onFocus={preloadContent} onPointerEnter={preloadContent}>
            Open optional UI
          </button>
          <button onClick={() => setOpen((isOpen) => !isOpen)}>Toggle content</button>
          <button onClick={() => setCount((value) => value + 1)}>Count: {count}</button>
          {open ? (
            <Suspense fallback={<span>Loading</span>}>
              <LazyContent />
            </Suspense>
          ) : null}
        </>
      );
    }

    const view = render(<Harness />);
    expect(screen.queryByText("Optional content")).not.toBeInTheDocument();
    expect(intentMount).not.toHaveBeenCalled();
    expect(loader).not.toHaveBeenCalled();

    fireEvent.pointerEnter(screen.getByRole("button", { name: "Open optional UI" }));
    await waitFor(() => expect(loader).toHaveBeenCalledOnce());
    fireEvent.focus(screen.getByRole("button", { name: "Open optional UI" }));
    expect(loader).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole("button", { name: "Count: 0" }));
    expect(screen.getByRole("button", { name: "Count: 1" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Toggle content" }));
    expect(await screen.findByText("Optional content")).toBeInTheDocument();
    expect(intentMount).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole("button", { name: "Toggle content" }));
    expect(intentCleanup).toHaveBeenCalledOnce();
    expect(screen.queryByText("Optional content")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Count: 1" })).toBeInTheDocument();
    expect(runtimeMount).toHaveBeenCalledOnce();
    expect(runtimeCleanup).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Toggle content" }));
    expect(await screen.findByText("Optional content")).toBeInTheDocument();
    expect(loader).toHaveBeenCalledOnce();
    expect(intentMount).toHaveBeenCalledTimes(2);
    expect(runtimeMount).toHaveBeenCalledOnce();

    view.unmount();
    expect(intentCleanup).toHaveBeenCalledTimes(2);
    expect(runtimeCleanup).toHaveBeenCalledOnce();
  });

  it("opens when activated before any preload", async () => {
    const loader = vi.fn(async () => ({ default: DirectContent }));
    const LazyContent = lazyWithPreload<Record<string, never>>(loader);

    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>Open directly</button>
          {open ? (
            <Suspense fallback={<span>Loading</span>}>
              <LazyContent />
            </Suspense>
          ) : null}
        </>
      );
    }

    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Open directly" }));

    expect(await screen.findByText("Direct content")).toBeInTheDocument();
    expect(loader).toHaveBeenCalledOnce();
  });
});

const intentMount = vi.fn();
const intentCleanup = vi.fn();
const runtimeMount = vi.fn();
const runtimeCleanup = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
});

function IntentContent() {
  useEffect(() => {
    intentMount();
    return intentCleanup;
  }, []);
  return <p>Optional content</p>;
}

function DirectContent() {
  return <p>Direct content</p>;
}

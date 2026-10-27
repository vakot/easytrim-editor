import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { stubIntersectionObserver } from "../../test/intersection-observer.mock";

/** The module keeps one shared observer, so each test starts from a fresh copy of it. */
async function loadReveal() {
  vi.resetModules();
  return import("../reveal.utils");
}

function createElement(parent: HTMLElement) {
  const element = document.createElement("div");
  parent.append(element);
  return element;
}

describe("reveal", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
  });

  afterEach(() => {
    container.remove();
    vi.unstubAllGlobals();
  });

  it("marks elements for reveal and keeps them hidden until they are seen", async () => {
    const mock = stubIntersectionObserver();
    const { reveal } = await loadReveal();
    const element = createElement(container);

    expect(reveal["data-reveal"]).toBe("");
    reveal.ref(element);

    expect(mock.instances).toHaveLength(1);
    expect(mock.instances[0]!.observed.has(element)).toBe(true);
    expect(element).not.toHaveAttribute("data-revealed");

    mock.instances[0]!.show([element], false);
    expect(element).not.toHaveAttribute("data-revealed");
  });

  it("reveals an element once and stops watching it", async () => {
    const mock = stubIntersectionObserver();
    const { reveal } = await loadReveal();
    const element = createElement(container);
    reveal.ref(element);

    mock.instances[0]!.show([element]);

    expect(element).toHaveAttribute("data-revealed");
    expect(mock.instances[0]!.unobserve).toHaveBeenCalledWith(element);
    expect(mock.instances[0]!.observed.has(element)).toBe(false);
  });

  it("staggers elements that appear together, in page order", async () => {
    const mock = stubIntersectionObserver();
    const { reveal } = await loadReveal();
    const first = createElement(container);
    const second = createElement(container);
    const third = createElement(container);

    for (const element of [third, first, second]) reveal.ref(element);

    // The observer may report them in any order; they still appear top to bottom.
    mock.instances[0]!.show([third, first, second]);

    expect(first.style.getPropertyValue("--reveal-delay")).toBe("0ms");
    expect(second.style.getPropertyValue("--reveal-delay")).toBe("80ms");
    expect(third.style.getPropertyValue("--reveal-delay")).toBe("160ms");
  });

  it("restarts the sequence for elements that appear later", async () => {
    const mock = stubIntersectionObserver();
    const { reveal } = await loadReveal();
    const first = createElement(container);
    const second = createElement(container);

    reveal.ref(first);
    reveal.ref(second);

    mock.instances[0]!.show([first]);
    mock.instances[0]!.show([second]);

    expect(second.style.getPropertyValue("--reveal-delay")).toBe("0ms");
  });

  it("tightens the steps of a large group so the whole sequence stays short", async () => {
    const mock = stubIntersectionObserver();
    const { reveal } = await loadReveal();
    const elements = Array.from({ length: 11 }, () => createElement(container));
    for (const element of elements) reveal.ref(element);

    mock.instances[0]!.show(elements);

    const delays = elements.map((element) =>
      parseInt(element.style.getPropertyValue("--reveal-delay")),
    );

    expect(delays[0]).toBe(0);
    expect(delays.at(-1)).toBe(400);
    expect(new Set(delays).size).toBe(elements.length);
    expect(delays).toEqual([...delays].sort((first, second) => first - second));
  });

  it("stops watching an element that unmounts", async () => {
    const mock = stubIntersectionObserver();
    const { reveal } = await loadReveal();
    const element = createElement(container);
    const cleanup = reveal.ref(element) as () => void;

    cleanup();

    expect(mock.instances[0]!.unobserve).toHaveBeenCalledWith(element);
  });

  it("shows content straight away where observers are unavailable", async () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    const { reveal } = await loadReveal();
    const element = createElement(container);

    reveal.ref(element);

    expect(element).toHaveAttribute("data-revealed");
  });

  it("starts an element once a sliver clears the bottom edge", async () => {
    const mock = stubIntersectionObserver();
    const { reveal } = await loadReveal();
    reveal.ref(createElement(container));

    expect(mock.instances[0]!.options).toEqual({
      rootMargin: "0px 0px -8% 0px",
      threshold: 0.1,
    });
  });
});

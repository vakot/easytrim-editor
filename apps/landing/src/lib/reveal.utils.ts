import type { RefCallback } from "react";

/** The delay between neighbors that appear together, and the longest delay any one of them gets. */
const REVEAL_STEP_MS = 80;
const REVEAL_MAX_DELAY_MS = 400;
/** Names the entrance keyframes in `globals.css`, so callers can tell when an element has settled. */
const REVEAL_ANIMATION_NAME = "landing-reveal";

let observer: IntersectionObserver | undefined;

function inDocumentOrder(first: Element, second: Element) {
  return first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
}

function show(element: Element, delayMs: number) {
  (element as HTMLElement).style.setProperty("--reveal-delay", `${delayMs}ms`);
  element.setAttribute("data-revealed", "");
}

/**
 * Elements that scroll into view together appear one after another in page order, so a heading
 * leads its text and a row of cards fills in left to right. Each element is released after its
 * first reveal, so scrolling away and back never replays it.
 */
function revealEntering(entries: IntersectionObserverEntry[]) {
  const entering = entries
    .filter((entry) => entry.isIntersecting)
    .map((entry) => entry.target)
    .sort(inDocumentOrder);

  // A big group tightens its steps rather than bunching up at the limit, so each still follows the last.
  const step = Math.min(REVEAL_STEP_MS, REVEAL_MAX_DELAY_MS / Math.max(entering.length - 1, 1));

  entering.forEach((element, index) => {
    show(element, Math.round(index * step));
    observer?.unobserve(element);
  });
}

function observeReveal(element: Element | null) {
  if (!element) return;
  // Without observer support the content simply shows, never staying hidden.
  if (typeof IntersectionObserver === "undefined") {
    show(element, 0);
    return;
  }

  // Nothing counts as visible until it clears the bottom edge by a little, so entrances are seen.
  observer ??= new IntersectionObserver(revealEntering, {
    rootMargin: "0px 0px -8% 0px",
    threshold: 0.1,
  });
  observer.observe(element);

  return () => observer?.unobserve(element);
}

/**
 * Spread onto an element to fade it in the first time it scrolls into view. It hides the element
 * with CSS until then and is a no-op for visitors who prefer reduced motion. State lives in DOM
 * attributes, so revealing never re-renders React.
 */
const reveal: { "data-reveal": ""; ref: RefCallback<Element> } = {
  "data-reveal": "",
  ref: observeReveal,
};

export { observeReveal, reveal, REVEAL_ANIMATION_NAME };

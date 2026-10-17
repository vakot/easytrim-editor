"use client";

import { animate, useReducedMotion } from "motion/react";
import { useLayoutEffect, useMemo, useRef } from "react";

import { cn } from "@/lib/class-names.utils";

type TextRevealProps = {
  className?: string;
  /** Styles the glyphs shown in place of characters that are not resolved yet. */
  glyphClassName?: string;
  /** The symbols unresolved characters cycle through. */
  glyphs: readonly string[];
  /** Plays no animation and shows the text at once; defaults to the reduced-motion preference. */
  reducedMotion?: boolean;
  /** Seconds the glyphs cycle before the first character resolves. */
  resolveAfter?: number;
  /** Seconds the characters take to resolve one after another, from first to last. */
  resolveDuration?: number;
  text: string;
};

const GLYPH_INTERVAL_MS = 70;
const DEFAULT_RESOLVE_DURATION = 1.2;

/** Splits into user-perceived characters, so combining marks and emoji sequences stay whole. */
function splitCharacters(text: string): string[] {
  if (typeof Intl.Segmenter !== "function") return Array.from(text);
  return Array.from(
    new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text),
    (part) => part.segment,
  );
}

/**
 * Starts the reveal on already rendered slots and returns a cleanup that stops it. Everything is
 * written straight to the DOM from one animation driver, so React never re-renders per frame.
 */
function playReveal(
  root: HTMLElement,
  glyphs: readonly string[],
  resolveAfter: number,
  resolveDuration: number,
) {
  const slots = [...root.querySelectorAll<HTMLElement>("[data-slot='text-reveal-char']")];
  const glyphNodes = slots.map((slot) => slot.querySelector<HTMLElement>("[data-glyph]"));
  if (slots.length === 0 || glyphs.length === 0) return undefined;

  let resolved = 0;
  let tick = 0;

  const randomGlyph = () => glyphs[Math.floor(Math.random() * glyphs.length)] ?? "";
  const scramble = () => {
    for (let index = resolved; index < slots.length; index += 1) {
      const node = glyphNodes[index];
      if (node) node.textContent = randomGlyph();
    }
  };

  const settleUntil = (count: number) => {
    for (; resolved < count; resolved += 1) {
      const node = glyphNodes[resolved];
      if (node) node.textContent = "";
      slots[resolved]!.dataset.resolved = "true";
    }
  };

  for (const slot of slots) slot.dataset.resolved = "false";
  scramble();

  const total = resolveAfter + resolveDuration;
  const controls = animate(0, total, {
    duration: total,
    ease: "linear",
    onComplete: () => settleUntil(slots.length),
    onUpdate: (elapsed) => {
      const progress = Math.min(Math.max((elapsed - resolveAfter) / resolveDuration, 0), 1);
      settleUntil(Math.floor(progress * slots.length));

      const nextTick = Math.floor((elapsed * 1000) / GLYPH_INTERVAL_MS);
      if (nextTick === tick) return;
      tick = nextTick;
      scramble();
    },
  });

  return () => controls.stop();
}

/**
 * Text that starts as cycling glyphs and resolves into the real characters, left to right.
 *
 * Layout is the final text's from the first frame: every character keeps its own slot and the
 * glyph is drawn over it, so nothing shifts while characters resolve. The real text stays in the
 * accessibility tree throughout; the animated layer is hidden from assistive technology.
 */
function TextReveal({
  className,
  glyphClassName,
  glyphs,
  reducedMotion,
  resolveAfter = 0,
  resolveDuration = DEFAULT_RESOLVE_DURATION,
  text,
}: TextRevealProps) {
  const rootRef = useRef<HTMLSpanElement>(null);
  const systemReducedMotion = useReducedMotion();
  const reduceMotion = reducedMotion ?? systemReducedMotion ?? false;
  const characters = useMemo(() => splitCharacters(text), [text]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || reduceMotion) return;
    return playReveal(root, glyphs, resolveAfter, resolveDuration);
  }, [glyphs, reduceMotion, resolveAfter, resolveDuration, text]);

  return (
    <span className={className} data-slot="text-reveal">
      <span className="sr-only">{text}</span>
      <span aria-hidden="true" key={text} ref={rootRef}>
        {characters.map((character, index) =>
          character.trim() === "" ? (
            character
          ) : (
            <span
              className="relative data-[resolved=false]:text-transparent"
              data-slot="text-reveal-char"
              key={index}
            >
              {character}
              <span
                className={cn(
                  "pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 select-none",
                  glyphClassName,
                )}
                data-glyph=""
              />
            </span>
          ),
        )}
      </span>
    </span>
  );
}

export { TextReveal };

import type * as React from "react";
import { useRef } from "react";

const SNAP_TARGETS = '[data-slot="slider-thumb"], [data-slot="slider-marker"]';

interface SliderSnappingOptions {
  dir?: "ltr" | "rtl";
  inverted: boolean;
  max: number;
  min: number;
  minStepsBetweenThumbs: number;
  orientation: "horizontal" | "vertical";
  snap: boolean | "shift";
  snapThreshold: number;
  step: number;
}

interface ActivePointer {
  root: HTMLElement;
  shift: boolean;
  thumb: Element | null;
}

/** Maps between slider values and the active root's pixel layout. */
interface Track {
  /** Pixels the thumb center can travel. */
  travel: number;
  /** Converts a layout element's center into a value on this slider. */
  valueAt: (target: Element) => number;
}

function getScope(element: Element, fallback: Element) {
  return element.closest('[data-slot="slider-group"]') ?? fallback;
}

function isSnapTarget(target: Element, active: ActivePointer, scope: Element) {
  return (
    target !== active.thumb &&
    target.getAttribute("data-snap-target") !== "false" &&
    !target.closest('[data-slot="slider"][data-snap-target="false"]') &&
    getScope(target, active.root) === scope
  );
}

/** Shared-scale groups read declared values; layout rounding is lossy on long ranges. */
function readDeclaredValue(target: Element) {
  return Number(
    target.getAttribute("data-slot") === "slider-marker"
      ? target.getAttribute("data-snap-value")
      : target.getAttribute("aria-valuenow"),
  );
}

function measureTrack(
  active: ActivePointer,
  { dir, inverted, max, min, orientation }: SliderSnappingOptions,
): Track {
  const vertical = orientation === "vertical";
  const bounds = active.root.getBoundingClientRect();
  const thumbBounds = active.thumb?.getBoundingClientRect();
  const thumbSize = thumbBounds ? (vertical ? thumbBounds.height : thumbBounds.width) : 0;
  const origin = vertical ? bounds.top : bounds.left;
  const travel = (vertical ? bounds.height : bounds.width) - thumbSize;
  const rtl = (dir ?? getComputedStyle(active.root).direction) === "rtl";
  const reverse = vertical || rtl ? !inverted : inverted;

  return {
    travel,
    valueAt: (target) => {
      const rect = target.getBoundingClientRect();
      const center = vertical ? rect.top + rect.height / 2 : rect.left + rect.width / 2;
      const fraction = (center - origin - thumbSize / 2) / travel;
      return min + (reverse ? 1 - fraction : fraction) * (max - min);
    },
  };
}

/**
 * Pointer-driven snapping for one slider root. Thumbs and markers in the same
 * `Slider.Group` (or the root itself) are candidate targets.
 */
function useSliderSnapping(options: SliderSnappingOptions) {
  const pointer = useRef<ActivePointer | null>(null);

  function clear() {
    pointer.current?.root.removeAttribute("data-snap-active");
    pointer.current?.thumb?.removeAttribute("data-snap-active");
  }

  function stop() {
    clear();
    pointer.current = null;
  }

  function findSnappedValue(active: ActivePointer, next: number[], index: number) {
    const { max, min, minStepsBetweenThumbs, snapThreshold, step } = options;
    const track = measureTrack(active, options);
    if (track.travel <= 0 || max <= min) return undefined;

    const scope = getScope(active.root, active.root);
    const shared = scope.hasAttribute("data-shared-scale");
    const requested = next[index] ?? min;
    const gap = step * minStepsBetweenThumbs;
    const lower = index > 0 ? next[index - 1]! + gap : min;
    const upper = index < next.length - 1 ? next[index + 1]! - gap : max;

    let distance = snapThreshold;
    let snapped: number | undefined;
    for (const target of scope.querySelectorAll(SNAP_TARGETS)) {
      if (!isSnapTarget(target, active, scope)) continue;
      const value = shared ? readDeclaredValue(target) : track.valueAt(target);
      if (!Number.isFinite(value) || value < min || value > max) continue;

      const rounded = Number((min + Math.round((value - min) / step) * step).toFixed(10));
      const pixels = (Math.abs(value - requested) / (max - min)) * track.travel;
      if (rounded < lower || rounded > upper || pixels > distance) continue;

      distance = pixels;
      snapped = rounded;
    }
    return snapped;
  }

  return {
    get active() {
      return pointer.current !== null;
    },

    start(event: React.PointerEvent<HTMLElement>) {
      pointer.current = {
        root: event.currentTarget,
        thumb:
          event.target instanceof Element
            ? event.target.closest('[data-slot="slider-thumb"]')
            : null,
        shift: event.shiftKey,
      };
    },

    track(event: React.PointerEvent) {
      if (pointer.current) pointer.current.shift = event.shiftKey;
    },

    stop,

    /** Stops after Radix has delivered the final value change for this release. */
    release() {
      const active = pointer.current;
      queueMicrotask(() => {
        if (pointer.current === active) stop();
      });
    },

    /** Returns `next` with the dragged thumb moved onto the nearest snap target, if any. */
    apply(next: number[], previous: number[]) {
      clear();
      const active = pointer.current;
      const { snap } = options;
      if (!active || !snap || (snap === "shift" && !active.shift)) return next;

      const thumbs = Array.from(active.root.querySelectorAll('[data-slot="slider-thumb"]'));
      let index = active.thumb ? thumbs.indexOf(active.thumb) : -1;
      if (index < 0) index = next.findIndex((entry, i) => entry !== previous[i]);
      if (index < 0) index = 0;
      active.thumb = thumbs[index] ?? null;

      const snapped = findSnappedValue(active, next, index);
      if (snapped === undefined) return next;

      active.root.setAttribute("data-snap-active", "true");
      active.thumb?.setAttribute("data-snap-active", "true");
      return next.map((entry, i) => (i === index ? snapped : entry));
    },
  };
}

export { useSliderSnapping };

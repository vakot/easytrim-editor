"use client";

import { animate, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";

import { cn } from "@/lib/class-names.utils";

type ConfettiIntensity = "subtle" | "normal" | "celebration";

type ConfettiProps = {
  /** Fires one burst each time it becomes true; toggle it off and on to replay. */
  active: boolean;
  /** Positions the layer. Defaults to filling the nearest positioned ancestor. */
  className?: string;
  /** Wait before the burst starts, in seconds. */
  delay?: number;
  /** Particle lifetime in seconds. */
  duration?: number;
  intensity?: ConfettiIntensity;
};

const DEFAULT_DURATION = 1.6;
const PARTICLE_COUNT: Record<ConfettiIntensity, number> = {
  celebration: 96,
  normal: 44,
  subtle: 18,
};

/** Theme tokens only, so the burst follows the light and dark palettes. */
const PARTICLE_COLORS = ["bg-primary", "bg-success", "bg-warning", "bg-destructive"];
const PARTICLE_CLASS =
  "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 will-change-transform";

/* Distances are rem so the burst scales with the root font size. Host size is measured once per
   burst and capped so large containers do not turn into a full-screen blast. */
const MAX_TRAVEL_REM = 16;
const MAX_FALL_REM = 4;
const FALL_FRACTION = 0.8;
const MIN_REACH = 0.5;
const MIN_PARTICLE_REM = 0.3;
const PARTICLE_SIZE_RANGE_REM = 0.25;

/* Sampled path: Motion hands these to the browser as compositor-driven keyframes, so no
   JavaScript runs per frame. Segments are linear; enough samples keep the arc smooth. */
const SAMPLES = 10;
const FADE_START = 0.6;
const MIN_LIFETIME_FRACTION = 0.75;
const MAX_SPIN_DEGREES = 720;
const MIN_SPIN_DEGREES = 360;

function easeOutCubic(progress: number) {
  return 1 - (1 - progress) ** 3;
}

function createParticle(index: number, count: number, halfWidthRem: number, halfHeightRem: number) {
  const angle = ((index + Math.random()) / count) * Math.PI * 2;
  const reach = MIN_REACH + Math.random() * (1 - MIN_REACH);
  const travelX = Math.cos(angle) * reach * Math.min(halfWidthRem, MAX_TRAVEL_REM);
  const travelY = Math.sin(angle) * reach * Math.min(halfHeightRem, MAX_TRAVEL_REM);
  const fall = Math.min(halfHeightRem * FALL_FRACTION, MAX_FALL_REM);
  const spin =
    (MIN_SPIN_DEGREES + Math.random() * (MAX_SPIN_DEGREES - MIN_SPIN_DEGREES)) *
    (Math.random() < 0.5 ? -1 : 1);

  const transform: string[] = [];
  const opacity: number[] = [];
  for (let step = 0; step <= SAMPLES; step += 1) {
    const progress = step / SAMPLES;
    const distance = easeOutCubic(progress);
    const x = travelX * distance;
    const y = travelY * distance + fall * progress ** 2;
    transform.push(
      `translate(${x.toFixed(3)}rem, ${y.toFixed(3)}rem) rotate(${spin * progress}deg)`,
    );
    opacity.push(progress <= FADE_START ? 1 : 1 - (progress - FADE_START) / (1 - FADE_START));
  }

  const isCircle = Math.random() < 0.35;
  const size = MIN_PARTICLE_REM + Math.random() * PARTICLE_SIZE_RANGE_REM;
  return {
    isCircle,
    lifetimeFraction: MIN_LIFETIME_FRACTION + Math.random() * (1 - MIN_LIFETIME_FRACTION),
    opacity,
    sizeRem: size,
    transform,
  };
}

/** Starts one burst inside `host` and returns a cleanup that cancels and removes it. */
function launchBurst(host: HTMLElement, count: number, duration: number, delay: number) {
  const { height, width } = host.getBoundingClientRect();
  const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  const nodes: HTMLElement[] = [];
  const animations: { cancel: () => void }[] = [];

  for (let index = 0; index < count; index += 1) {
    const particle = createParticle(index, count, width / 2 / rem, height / 2 / rem);
    const node = document.createElement("span");
    node.className = cn(
      PARTICLE_CLASS,
      PARTICLE_COLORS[index % PARTICLE_COLORS.length],
      particle.isCircle && "rounded-full",
    );
    node.style.width = `${particle.sizeRem * (particle.isCircle ? 1 : 0.6)}rem`;
    node.style.height = `${particle.sizeRem * (particle.isCircle ? 1 : 1.6)}rem`;
    if (delay > 0) node.style.opacity = "0";
    host.append(node);
    nodes.push(node);

    const particleDuration = duration * particle.lifetimeFraction;
    const delayFraction = delay / (delay + particleDuration);
    const opacity = delay > 0 ? [0, 0, ...particle.opacity] : particle.opacity;
    const transform =
      delay > 0
        ? [particle.transform[0]!, particle.transform[0]!, ...particle.transform]
        : particle.transform;

    const times =
      delay > 0
        ? [
            0,
            Math.max(0, delayFraction - 0.001),
            delayFraction,
            ...Array.from(
              { length: SAMPLES },
              (_, step) => delayFraction + (1 - delayFraction) * ((step + 1) / SAMPLES),
            ),
          ]
        : undefined;

    const controls = animate(
      node,
      { opacity, transform },
      { duration: delay + particleDuration, ease: "linear", times },
    );

    animations.push(controls);
    void controls.then(() => node.remove());
  }

  return () => {
    for (const controls of animations) controls.cancel();
    for (const node of nodes) node.remove();
  };
}

/**
 * Decorative particle burst from the center of its positioned host, clipped to that host.
 * Presentation only: it knows nothing about what is being celebrated and is disabled under
 * `prefers-reduced-motion`.
 */
function Confetti({
  active,
  className,
  delay = 0,
  duration = DEFAULT_DURATION,
  intensity = "normal",
}: ConfettiProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const host = hostRef.current;
    if (!active || reduceMotion || !host) return;
    return launchBurst(host, PARTICLE_COUNT[intensity], duration, delay);
  }, [active, delay, duration, intensity, reduceMotion]);

  return (
    <div
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
      data-slot="confetti"
      ref={hostRef}
    />
  );
}

export { Confetti };
export type { ConfettiIntensity };

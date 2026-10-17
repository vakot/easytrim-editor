"use client";

import { animate, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";

import { cn } from "@/lib/class-names.utils";

type ConfettiMode = "center" | "border-outside" | "border-inside";

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
  /** Particle origin and direction. Defaults to a center burst. */
  mode?: ConfettiMode;
};

const DEFAULT_DURATION = 1.6;
/** Keep emission sparse and sustained across the full perimeter. */
const EMISSION_DURATION_FRACTION = 0.5;
const PARTICLES_PER_BURST = 4;
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
const TRAVEL_SCALE = 1;
const MAX_TRAVEL_REM = 8;
const MAX_FALL_REM = 4;
const FALL_FRACTION = 0.75;
const MIN_REACH = 0.1;
const MIN_PARTICLE_REM = 0.25;
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

function createParticle(
  index: number,
  halfWidthRem: number,
  halfHeightRem: number,
  mode: ConfettiMode,
  edge: number,
) {
  const angle =
    (((index % PARTICLES_PER_BURST) + Math.random()) / PARTICLES_PER_BURST) * Math.PI * 2;

  const reach = MIN_REACH + Math.random() * (1 - MIN_REACH);
  const range = Math.min(halfWidthRem, halfHeightRem, MAX_TRAVEL_REM) * reach;
  let travelX = Math.cos(angle) * range;
  let travelY = Math.sin(angle) * range;
  const fall = Math.min(range * FALL_FRACTION, MAX_FALL_REM);
  let startX = 0;
  let startY = 0;
  if (mode !== "center") {
    // Edge selection is weighted by length; positions are independent of launch time.
    const position = Math.random() * 2 - 1;
    if (edge === 0) {
      startX = position * halfWidthRem;
      startY = -halfHeightRem;
    } else if (edge === 1) {
      startX = halfWidthRem;
      startY = position * halfHeightRem;
    } else if (edge === 2) {
      startX = position * halfWidthRem;
      startY = halfHeightRem;
    } else {
      startX = -halfWidthRem;
      startY = position * halfHeightRem;
    }
    const direction = mode === "border-inside" ? -1 : 1;
    // Use edge normals and one shared range, independent of distance from the center.
    travelX = direction * (edge === 1 ? 1 : edge === 3 ? -1 : 0) * range;
    travelY = direction * (edge === 2 ? 1 : edge === 0 ? -1 : 0) * range;
  }
  const spin =
    (MIN_SPIN_DEGREES + Math.random() * (MAX_SPIN_DEGREES - MIN_SPIN_DEGREES)) *
    (Math.random() < 0.5 ? -1 : 1);

  const transform: string[] = [];
  const opacity: number[] = [];
  for (let step = 0; step <= SAMPLES; step += 1) {
    const progress = step / SAMPLES;
    const distance = easeOutCubic(progress);
    const x = startX + travelX * distance * TRAVEL_SCALE;
    const fallingY = startY + travelY * distance + fall * progress ** 2;
    const boundedY =
      mode === "border-inside"
        ? Math.min(halfHeightRem, Math.max(-halfHeightRem, fallingY))
        : fallingY;

    const y = startY + (boundedY - startY) * TRAVEL_SCALE;

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
function launchBurst(
  host: HTMLElement,
  count: number,
  duration: number,
  delay: number,
  mode: ConfettiMode,
) {
  const { height, width } = host.getBoundingClientRect();
  const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  const nodes: HTMLElement[] = [];
  const animations: { cancel: () => void }[] = [];

  const edgeLengths = width + height > 0 ? [width, height, width, height] : [1, 1, 1, 1];
  const perimeter = edgeLengths.reduce((total, length) => total + length, 0);
  let allocated = 0;
  let coveredLength = 0;
  const launches =
    mode === "center"
      ? Array.from({ length: count }, (_, index) => ({
          edge: index % PARTICLES_PER_BURST,
          progress:
            Math.floor(index / PARTICLES_PER_BURST) /
            Math.max(1, Math.ceil(count / PARTICLES_PER_BURST) - 1),
        }))
      : edgeLengths
          .flatMap((length, edge) => {
            coveredLength += length;
            const cumulativeCount = Math.round((count * coveredLength) / perimeter);
            const edgeCount = cumulativeCount - allocated;
            allocated = cumulativeCount;
            return Array.from({ length: edgeCount }, (_, index) => ({
              edge,
              progress: index / Math.max(1, edgeCount - 1),
            }));
          })
          .sort((a, b) => a.progress - b.progress);

  for (const [index, launch] of launches.entries()) {
    const launchDelay = delay + launch.progress * duration * EMISSION_DURATION_FRACTION;
    const particle = createParticle(index, width / 2 / rem, height / 2 / rem, mode, launch.edge);

    const node = document.createElement("span");
    node.className = cn(
      PARTICLE_CLASS,
      PARTICLE_COLORS[index % PARTICLE_COLORS.length],
      particle.isCircle && "rounded-full",
    );
    node.style.width = `${particle.sizeRem * (particle.isCircle ? 1 : 0.6)}rem`;
    node.style.height = `${particle.sizeRem * (particle.isCircle ? 1 : 1.6)}rem`;
    if (launchDelay > 0) node.style.opacity = "0";
    host.append(node);
    nodes.push(node);

    const particleDuration = duration * particle.lifetimeFraction;
    const launchDelayFraction = launchDelay / (launchDelay + particleDuration);
    const opacity = launchDelay > 0 ? [0, 0, ...particle.opacity] : particle.opacity;
    const transform =
      launchDelay > 0
        ? [particle.transform[0]!, particle.transform[0]!, ...particle.transform]
        : particle.transform;

    const times =
      launchDelay > 0
        ? [
            0,
            Math.max(0, launchDelayFraction - 0.001),
            launchDelayFraction,
            ...Array.from(
              { length: SAMPLES },
              (_, step) => launchDelayFraction + (1 - launchDelayFraction) * ((step + 1) / SAMPLES),
            ),
          ]
        : undefined;

    const controls = animate(
      node,
      { opacity, transform },
      { duration: launchDelay + particleDuration, ease: "linear", times },
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
 * Decorative particle burst with a configurable origin and direction.
 * Presentation only: it knows nothing about what is being celebrated and is disabled under
 * `prefers-reduced-motion`.
 */
function Confetti({
  active,
  className,
  delay = 0,
  duration = DEFAULT_DURATION,
  intensity = "normal",
  mode = "center",
}: ConfettiProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const host = hostRef.current;
    if (!active || reduceMotion || !host) return;
    return launchBurst(host, PARTICLE_COUNT[intensity], duration, delay, mode);
  }, [active, delay, duration, intensity, mode, reduceMotion]);

  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0",
        mode === "border-outside" ? "overflow-visible" : "overflow-hidden",
        className,
      )}
      data-slot="confetti"
      ref={hostRef}
    />
  );
}

export { Confetti };
export type { ConfettiIntensity, ConfettiMode };

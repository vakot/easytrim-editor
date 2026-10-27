import { Lock, Medal, Pause, Play, Sparkles } from "lucide-react";
import { type RefObject, useEffect, useRef, useState } from "react";

import { AchievementUnlockToast } from "@easytrim-editor/ui/achievement-unlock-toast";
import { Button } from "@easytrim-editor/ui/button";
import { cn } from "@easytrim-editor/ui/class-names";

import {
  onboardingAchievements,
  onboardingLoopTiming,
} from "../consts/onboarding-achievements.consts";

const details = [
  { icon: Medal, text: "Milestone series in Bronze, Silver, and Gold" },
  { icon: Sparkles, text: "Secret discoveries for the curious" },
  { icon: Lock, text: "Tracked only on your device and never shared" },
] as const;

/** One toast in the loop; the cycle tells repeated achievements apart so each replays. */
type LoopEntry = { cycle: number; index: number };

function nextEntry({ cycle, index }: LoopEntry): LoopEntry {
  return index + 1 < onboardingAchievements.length
    ? { cycle, index: index + 1 }
    : { cycle: cycle + 1, index: 0 };
}

function prefersReducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

/**
 * Cycles through the toasts while playing and on screen. The loop starts the first time the panel
 * is seen, so the first toast arrives in view, and keeps the previous toast briefly so it can fade
 * out over the next one's entrance.
 */
function useToastLoop(
  playing: boolean,
  animateExit: boolean,
  panel: RefObject<HTMLElement | null>,
) {
  const [visible, setVisible] = useState(true);
  const [started, setStarted] = useState(() => typeof IntersectionObserver === "undefined");
  const [current, setCurrent] = useState<LoopEntry>({ cycle: 0, index: 0 });
  const [leaving, setLeaving] = useState<LoopEntry | null>(null);

  useEffect(() => {
    const element = panel.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => {
      const intersecting = entry?.isIntersecting ?? true;
      setVisible(intersecting);
      if (intersecting) setStarted(true);
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, [panel]);

  useEffect(() => {
    if (!started || !playing || !visible) return;
    const timer = setTimeout(() => {
      if (animateExit) setLeaving(current);
      setCurrent(nextEntry(current));
    }, onboardingLoopTiming.toastMs);

    return () => clearTimeout(timer);
  }, [animateExit, current, playing, started, visible]);

  useEffect(() => {
    if (!leaving) return;
    const timer = setTimeout(() => setLeaving(null), onboardingLoopTiming.exitMs);

    return () => clearTimeout(timer);
  }, [leaving]);

  return { current: started ? current : null, leaving };
}

/**
 * The Getting Started achievements unlocking one after another with the application's own toast
 * and confetti. Visitors who prefer reduced motion get a still toast they can play; everyone can
 * pause the loop.
 */
function LandingAchievements() {
  const panel = useRef<HTMLDivElement>(null);
  const [reducedMotion] = useState(prefersReducedMotion);
  const [playing, setPlaying] = useState(!reducedMotion);
  const { current, leaving } = useToastLoop(playing, !reducedMotion, panel);

  // The outgoing toast renders last, so it fades out on top of the next one's entrance. Keys follow
  // each entry, so a toast that starts leaving keeps its instance instead of replaying.
  const toasts = [
    ...(current ? [{ entry: current, exiting: false }] : []),
    ...(leaving ? [{ entry: leaving, exiting: true }] : []),
  ];

  return (
    <section
      aria-labelledby="achievements-title"
      className="scroll-mt-16 py-20 sm:py-28"
      id="achievements"
    >
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16">
        <div>
          <p className="text-sm font-semibold tracking-widest text-primary uppercase">
            Achievements
          </p>
          <h2
            className="mt-3 text-3xl font-bold tracking-tight text-balance sm:text-4xl"
            id="achievements-title"
          >
            Your first edit, celebrated.
          </h2>
          <p className="mt-4 text-muted-foreground">
            The Getting Started achievements walk you through the essentials: importing, trimming,
            cropping, audio, the queue, and shortcuts. Each one is celebrated as you earn it.
          </p>
          <ul className="mt-6 grid gap-3 text-sm">
            {details.map(({ icon: Icon, text }) => (
              <li className="flex items-center gap-3" key={text}>
                <span
                  aria-hidden="true"
                  className="grid size-7 shrink-0 place-items-center rounded-md bg-primary/10 text-primary [&_svg]:size-4"
                >
                  <Icon />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        {/*
         * Toasts differ in height when a description wraps. Pinning them to the top of a panel
         * whose height never depends on them keeps every toast still; only the space below varies.
         */}
        <div
          aria-label="Achievement unlock preview"
          className="relative mx-auto h-64 w-full max-w-md rounded-2xl border bg-card/40 px-6 pt-20 sm:px-10"
          ref={panel}
          role="region"
        >
          <div className="grid w-full items-start">
            {toasts.map(({ entry, exiting }) => (
              <div
                aria-hidden={exiting ? "true" : undefined}
                className={cn(
                  "col-start-1 row-start-1",
                  exiting &&
                    "pointer-events-none animate-out animation-duration-300 fill-mode-forwards fade-out slide-out-to-top-3",
                )}
                data-slot={exiting ? "leaving-toast" : "current-toast"}
                key={`${entry.cycle}-${entry.index}`}
              >
                <AchievementUnlockToast
                  announcement={onboardingAchievements[entry.index]!}
                  reducedMotion={!playing}
                />
              </div>
            ))}
          </div>

          <Button
            aria-label={playing ? "Pause the preview" : "Play the preview"}
            className="absolute right-3 bottom-3"
            onClick={() => setPlaying((value) => !value)}
            size="icon-xs"
            variant="ghost"
          >
            {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
          </Button>
        </div>
      </div>
    </section>
  );
}

export { LandingAchievements };

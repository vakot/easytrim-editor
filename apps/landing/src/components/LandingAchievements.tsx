import { CircleCheck, Lock, Medal, Pause, Play, Sparkles } from "lucide-react";
import { type RefObject, useEffect, useRef, useState } from "react";

import { AchievementCard } from "@easytrim-editor/ui/achievement-card";
import { AchievementUnlockToast } from "@easytrim-editor/ui/achievement-unlock-toast";
import { Button } from "@easytrim-editor/ui/button";
import { Confetti } from "@easytrim-editor/ui/confetti";
import { ItemGroup } from "@easytrim-editor/ui/item";

import {
  onboardingAchievements,
  onboardingLoopTiming,
} from "../consts/onboarding-achievements.consts";

const details = [
  { icon: Medal, text: "Milestone series in Bronze, Silver, and Gold" },
  { icon: Sparkles, text: "Secret discoveries for the curious" },
  { icon: Lock, text: "Tracked only on your device and never shared" },
] as const;

/** One step per unlock, plus the fresh collection before them and the celebration after them. */
const completionStep = onboardingAchievements.length + 1;
/** Where a visitor who prefers reduced motion starts: a still frame with a few unlocks shown. */
const stillFrameStep = 2;

function stepDuration(step: number): number {
  if (step === 0) return onboardingLoopTiming.startMs;
  if (step === completionStep) return onboardingLoopTiming.completionMs;
  return onboardingLoopTiming.unlockMs;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

/** Advances the loop only while it plays and its panel is on screen. */
function useOnboardingLoop(
  playing: boolean,
  initialStep: number,
  panel: RefObject<HTMLElement | null>,
) {
  const [loop, setLoop] = useState({ cycle: 0, step: initialStep });
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const element = panel.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) =>
      setVisible(entry?.isIntersecting ?? true),
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [panel]);

  useEffect(() => {
    if (!playing || !visible) return;
    const timer = setTimeout(
      () =>
        setLoop(({ cycle, step }) =>
          step === completionStep ? { cycle: cycle + 1, step: 0 } : { cycle, step: step + 1 },
        ),
      stepDuration(loop.step),
    );

    return () => clearTimeout(timer);
  }, [loop.step, playing, visible]);

  return loop;
}

/**
 * The Getting Started achievements unlocking one after another, as they do during a first edit in
 * the application, with the same cards, toasts, and completion confetti. Visitors who prefer
 * reduced motion get a still frame they can play; everyone can pause the loop.
 */
function LandingAchievements() {
  const panel = useRef<HTMLDivElement>(null);
  const [reducedMotion] = useState(prefersReducedMotion);
  const [playing, setPlaying] = useState(!reducedMotion);
  const { cycle, step } = useOnboardingLoop(playing, reducedMotion ? stillFrameStep : 0, panel);

  const unlockedCount = Math.min(step, onboardingAchievements.length);
  const celebrating = step === completionStep;
  const latest = step > 0 && !celebrating ? onboardingAchievements[step - 1] : undefined;

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
            cropping, audio, the queue, and shortcuts. Each one is celebrated as you earn it, and
            finishing them all completes your onboarding.
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

        <div
          aria-label="Getting Started achievements preview"
          className="mx-auto w-full max-w-md rounded-2xl border bg-card/40 p-4 sm:p-6"
          ref={panel}
          role="region"
        >
          <div className="flex min-h-28 items-start">
            {latest ? (
              <AchievementUnlockToast
                announcement={latest}
                key={`${cycle}-${latest.id}`}
                reducedMotion={!playing}
              />
            ) : null}
          </div>

          <div className="mt-4 flex items-center gap-2">
            <h3 className="text-xs font-medium text-muted-foreground">Getting Started</h3>
            <span className="ml-auto text-xs text-muted-foreground tabular-nums">
              {unlockedCount} of {onboardingAchievements.length}
            </span>
            <Button
              aria-label={playing ? "Pause the preview" : "Play the preview"}
              onClick={() => setPlaying((current) => !current)}
              size="icon-xs"
              variant="ghost"
            >
              {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
            </Button>
          </div>

          <div className="relative mt-2">
            <ItemGroup className="grid grid-cols-1 gap-2">
              {onboardingAchievements.map((achievement, index) => {
                const unlocked = index < unlockedCount;

                return (
                  <AchievementCard
                    compact
                    description={achievement.description}
                    icon={achievement.icon}
                    key={achievement.id}
                    presentation="onboarding"
                    status={unlocked ? "Completed" : undefined}
                    title={achievement.title}
                    unlocked={unlocked}
                  />
                );
              })}
            </ItemGroup>

            {celebrating ? (
              <div
                className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-lg bg-card/80 text-success motion-safe:animate-in motion-safe:fade-in"
                data-slot="onboarding-completion"
              >
                <CircleCheck aria-hidden="true" className="size-10" />
                <span className="text-sm font-medium">Completed</span>
                <Confetti active={playing} intensity="celebration" mode="border-inside" />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

export { LandingAchievements };

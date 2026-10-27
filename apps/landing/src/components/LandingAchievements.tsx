import { LockKeyhole, PartyPopper, RotateCcw, Sparkles } from "lucide-react";
import { useState } from "react";

import { AchievementCard } from "@easytrim-editor/ui/achievement-card";
import { achievementTierClassNames } from "@easytrim-editor/ui/achievement-tier-styles";
import {
  type AchievementToastVariant,
  AchievementUnlockToast,
} from "@easytrim-editor/ui/achievement-unlock-toast";
import { Button } from "@easytrim-editor/ui/button";
import { cn } from "@easytrim-editor/ui/class-names";

import {
  concealedSecret,
  showcaseAchievements,
  showcaseVariants,
} from "../consts/showcase-achievements.consts";

/**
 * A hands-on preview of the application's achievement celebration: pick a variant and unlock it
 * to play the real card, toast, and confetti. Each unlock remounts the toast so it replays from the
 * start; reduced motion is honored by the shared components themselves.
 */
function LandingAchievements() {
  const [variant, setVariant] = useState<AchievementToastVariant>("gold");
  // Counts unlocks of the selected achievement; zero means it is still locked.
  const [unlocks, setUnlocks] = useState(0);

  const achievement = showcaseAchievements[variant];
  const unlocked = unlocks > 0;
  const concealed = variant === "secret" && !unlocked;

  function selectVariant(next: AchievementToastVariant) {
    setVariant(next);
    setUnlocks(0);
  }

  return (
    <section
      aria-labelledby="achievements-title"
      className="scroll-mt-16 py-20 sm:py-28"
      id="achievements"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold tracking-widest text-primary uppercase">
            Achievements
          </p>
          <h2
            className="mt-3 text-3xl font-bold tracking-tight text-balance sm:text-4xl"
            id="achievements-title"
          >
            A small celebration for finished work.
          </h2>
          <p className="mt-4 text-muted-foreground">
            EasyTrim keeps an optional collection of milestones and secrets. It is tracked only on
            your device and never shared. Unlock one here to see the same card and toast the app
            shows.
          </p>
        </div>

        <div className="mt-12 grid gap-8 rounded-2xl border bg-card/40 p-4 sm:p-8 lg:grid-cols-[minmax(0,26rem)_1fr] lg:gap-12">
          <div className="flex flex-col gap-6">
            <fieldset>
              <legend className="mb-3 text-sm font-medium">Choose a celebration</legend>
              <div className="flex flex-wrap gap-2">
                {showcaseVariants.map((option) => (
                  <label
                    className={cn(
                      "cursor-pointer rounded-full border bg-background px-3.5 py-1.5 text-sm text-muted-foreground transition-colors select-none hover:text-foreground has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                      variant === option.variant &&
                        "border-primary/60 bg-primary/10 text-foreground",
                    )}
                    key={option.variant}
                  >
                    <input
                      checked={variant === option.variant}
                      className="sr-only"
                      name="achievement-variant"
                      onChange={() => selectVariant(option.variant)}
                      type="radio"
                      value={option.variant}
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </fieldset>

            <div aria-label="Selected achievement" role="list">
              <AchievementCard
                className={
                  unlocked && achievement.tier
                    ? achievementTierClassNames[achievement.tier].card
                    : undefined
                }
                description={concealed ? concealedSecret.description : achievement.description}
                icon={concealed ? LockKeyhole : achievement.icon}
                secret={variant === "secret"}
                status={unlocked ? "Unlocked" : "Locked"}
                title={concealed ? concealedSecret.title : achievement.title}
                unlocked={unlocked}
              >
                {unlocked ? (
                  <p className="text-xs text-muted-foreground">Unlocked just now</p>
                ) : null}
              </AchievementCard>
            </div>

            <Button
              className="h-10 self-start px-4"
              onClick={() => setUnlocks((current) => current + 1)}
              size="lg"
              variant="secondary"
            >
              {unlocked ? (
                <RotateCcw aria-hidden="true" />
              ) : (
                <Sparkles aria-hidden="true" className="text-primary" />
              )}
              {unlocked ? "Play again" : "Unlock achievement"}
            </Button>
          </div>

          <div className="relative flex min-h-56 items-start justify-center rounded-xl border bg-background px-4 pt-10 pb-6 sm:px-8">
            {unlocked ? (
              <div className="w-full max-w-sm">
                <AchievementUnlockToast announcement={achievement} key={`${variant}-${unlocks}`} />
              </div>
            ) : (
              <p className="flex flex-col items-center gap-3 self-center text-center text-sm text-muted-foreground">
                <PartyPopper aria-hidden="true" className="size-6 text-primary/70" />
                Unlock the achievement to play its celebration.
              </p>
            )}
          </div>

          <p aria-live="polite" className="sr-only">
            {unlocked ? `${achievement.unlockedLabel}: ${achievement.title}` : ""}
          </p>
        </div>
      </div>
    </section>
  );
}

export { LandingAchievements };

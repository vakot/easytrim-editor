import { useReducedMotion } from "motion/react";
import type { CSSProperties } from "react";

import { Confetti } from "@/components/confetti";
import { Ribbon } from "@/components/ribbon";
import { TextReveal } from "@/components/text-reveal";
import { cn } from "@/lib/class-names.utils";

import { achievementTierClassNames } from "../consts/achievement-tier-styles.consts";
import {
  achievementToastPresentation,
  secretRevealEnd,
  secretRevealTimeline,
} from "../consts/achievement-toast.consts";
import { galacticGlyphs } from "../consts/galactic-glyphs.consts";
import { useAchievementSecretGradientId } from "../hooks/useAchievementSecretGradientId";
import type { AchievementAnnouncement } from "../types/achievement-toast.types";

import secretStyles from "./AchievementSecret.module.css";
import { AchievementSecretGradient } from "./AchievementSecretGradient";
import styles from "./AchievementUnlockToast.module.css";

type AchievementUnlockToastProps = {
  announcement: AchievementAnnouncement;
  /** Forces reduced motion on. The system preference always applies, so this can only add to it. */
  reducedMotion?: boolean;
};

const secretSheenStyle = (delay: number, duration: number) =>
  ({ "--sheen-delay": `${delay}s`, "--sheen-duration": `${duration}s` }) as CSSProperties;

/**
 * The celebration shown when an achievement unlocks. Its look follows the announcement's variant:
 * the theme's default surface for standard achievements, the tier's own colors for Bronze, Silver,
 * and Gold, and the iridescent secret treatment with a Galactic Glyphs reveal for secret ones.
 *
 * It only presents what it is given. When to show it, how long it stays, and its sound belong to
 * the announcement queue; the confetti burst plays once when the toast first appears.
 */
function AchievementUnlockToast({ announcement, reducedMotion }: AchievementUnlockToastProps) {
  const systemReducedMotion = useReducedMotion();
  const gradientId = useAchievementSecretGradientId();
  const reduceMotion = Boolean(reducedMotion || systemReducedMotion);

  const { description, icon: Icon, tier, tierLabel, title, unlockedLabel, variant } = announcement;
  const secret = variant === "secret";
  const tierStyles = tier ? achievementTierClassNames[tier] : null;

  return (
    <div className="relative isolate w-full">
      <Confetti
        active={!reduceMotion}
        className="z-0 overflow-visible"
        delay={0.3}
        intensity={achievementToastPresentation[variant].confetti}
        mode="border-outside"
      />

      <div
        className={cn(
          "relative z-10 w-full overflow-hidden rounded-lg border bg-popover p-4 text-popover-foreground shadow-lg",
          styles.toast,
          tierStyles?.toast,
          secret && secretStyles.card,
        )}
        data-reduced-motion={reduceMotion ? "true" : "false"}
        data-secret-state={secret ? "unlocked" : undefined}
        data-slot="achievement-unlock-toast"
        data-variant={variant}
        style={
          {
            "--highlight-duration": `${secretRevealTimeline.highlightDuration}s`,
            ...(secret ? { "--secret-icon-stroke": `url(#${gradientId})` } : {}),
          } as CSSProperties
        }
      >
        {tierStyles ? (
          <span
            aria-hidden="true"
            className={cn("absolute inset-0 -z-10", tierStyles.toastSurface)}
            data-slot="achievement-unlock-toast-surface"
          />
        ) : null}
        {secret ? <AchievementSecretGradient id={gradientId} /> : null}

        <div className="relative flex items-start gap-3">
          <span
            aria-hidden="true"
            className={cn(
              "grid size-10 shrink-0 place-items-center rounded-lg [&_svg]:size-5",
              styles.medallion,
              tierStyles ? cn("ring-1", tierStyles.medallion) : "bg-primary/10 text-primary",
              secret && secretStyles.medallion,
            )}
          >
            <Icon />
          </span>

          <div className="grid min-w-0 flex-1 gap-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{unlockedLabel}</span>
            </div>

            <p
              className={cn("text-sm font-semibold wrap-break-word", secret && "pr-4")}
              data-slot="achievement-unlock-title"
            >
              {secret ? (
                <TextReveal
                  glyphClassName="text-(--achievement-secret-azure)"
                  glyphs={galacticGlyphs}
                  reducedMotion={reduceMotion}
                  resolveAfter={secretRevealTimeline.titleResolveStart}
                  resolveDuration={secretRevealTimeline.titleResolveDuration}
                  text={title}
                />
              ) : (
                title
              )}
            </p>

            <p
              className="text-xs wrap-break-word text-muted-foreground"
              data-slot="achievement-unlock-description"
            >
              {secret ? (
                <TextReveal
                  glyphClassName="text-(--achievement-secret-rose)"
                  glyphs={galacticGlyphs}
                  reducedMotion={reduceMotion}
                  resolveAfter={secretRevealTimeline.descriptionResolveStart}
                  resolveDuration={secretRevealTimeline.descriptionResolveDuration}
                  text={description}
                />
              ) : (
                description
              )}
            </p>
          </div>
        </div>

        {secret ? (
          <Ribbon className="bg-red-700 text-white" data-slot="achievement-secret-ribbon">
            TOP SECRET
          </Ribbon>
        ) : null}
        {tierStyles && tierLabel ? (
          <Ribbon className={cn("border", tierStyles.badge)} data-slot="achievement-tier-ribbon">
            {tierLabel}
          </Ribbon>
        ) : null}

        {secret ? (
          <>
            <span
              aria-hidden="true"
              className={styles.sheen}
              style={secretSheenStyle(0.1, secretRevealTimeline.highlightDuration)}
            />
            <span
              aria-hidden="true"
              className={styles.sheen}
              style={secretSheenStyle(secretRevealEnd, secretRevealTimeline.finalShimmerDuration)}
            />
          </>
        ) : (
          <span aria-hidden="true" className={styles.sheen} />
        )}
      </div>
    </div>
  );
}

export { AchievementUnlockToast };

import { Check, Lock, type LucideIcon } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

import { useAchievementSecretGradientId } from "../hooks/use-achievement-secret-gradient-id";
import { cn } from "../lib/class-names.utils";

import { AchievementNewPing } from "./achievement-new-ping";
import styles from "./achievement-secret.module.css";
import { AchievementSecretGradient } from "./achievement-secret-gradient";
import { Badge } from "./badge";
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "./item";

type AchievementCardProps = {
  /** Details below the description, such as the unlock date or progress. */
  children?: ReactNode;
  className?: string;
  compact?: boolean;
  description: ReactNode;
  icon: LucideIcon;
  /** Screen reader text marking an achievement unlocked since the collection was last viewed. */
  newLabel?: string;
  /** Onboarding cards keep the card surface while locked. */
  presentation?: "achievement" | "onboarding";
  /** Secret achievements get the iridescent treatment; the caller decides what a locked one shows. */
  secret?: boolean;
  /** The status badge text; no badge is shown without it. */
  status?: string;
  title: ReactNode;
  unlocked: boolean;
};

/**
 * One achievement in a collection: its icon, name, description, and status. It only presents
 * what it is given; whether it is unlocked, new, or concealed, and the localized text, come from
 * the caller.
 */
function AchievementCard({
  children,
  className,
  compact = false,
  description,
  icon: Icon,
  newLabel,
  presentation = "achievement",
  secret = false,
  status,
  title,
  unlocked,
}: AchievementCardProps) {
  const gradientId = useAchievementSecretGradientId();
  const isNew = newLabel !== undefined;

  return (
    <Item
      className={cn(
        "items-start",
        compact && "p-2",
        presentation === "onboarding" ? "bg-card" : !unlocked && "bg-muted/40",
        secret && styles.card,
        className,
      )}
      data-secret={secret ? "true" : undefined}
      data-secret-state={secret ? (unlocked ? "unlocked" : "locked") : undefined}
      data-state={unlocked ? "unlocked" : "locked"}
      role="listitem"
      size={compact ? "xs" : "sm"}
      style={
        secret ? ({ "--secret-icon-stroke": `url(#${gradientId})` } as CSSProperties) : undefined
      }
      variant="outline"
    >
      {secret ? <AchievementSecretGradient id={gradientId} /> : null}
      <ItemMedia
        aria-hidden="true"
        className={cn(
          "relative rounded-lg",
          compact
            ? "size-8 group-has-data-[slot=item-description]/item:translate-y-0 [&_svg:not([class*='size-'])]:size-4"
            : "size-11 [&_svg:not([class*='size-'])]:size-5",
          unlocked ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
          secret && styles.medallion,
        )}
        variant="icon"
      >
        <Icon />
        {isNew ? <AchievementNewPing /> : null}
      </ItemMedia>
      <ItemContent className={cn("min-w-0", compact ? "gap-0.5" : "gap-1")}>
        <div className="flex items-start justify-between gap-2">
          <ItemTitle
            className={cn(
              "min-w-0 wrap-break-word",
              compact && "text-xs",
              !unlocked && "text-muted-foreground",
            )}
          >
            {title}
          </ItemTitle>
          {isNew ? <span className="sr-only">{newLabel}</span> : null}
          {status ? (
            <Badge size="xs" variant={unlocked ? "success" : "outline"}>
              {unlocked ? <Check aria-hidden="true" /> : <Lock aria-hidden="true" />}
              {status}
            </Badge>
          ) : null}
        </div>
        <ItemDescription className="text-xs">{description}</ItemDescription>
        {children}
      </ItemContent>
    </Item>
  );
}

export { AchievementCard };

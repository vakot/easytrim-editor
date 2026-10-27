import { cn } from "@easytrim-editor/ui/class-names";

import type { Screenshot } from "../consts/screenshots.consts";
import { reveal } from "../lib/reveal.utils";

type LandingScreenshotProps = {
  className?: string;
  /** Loads the image right away; reserve it for the screenshot visible on arrival. */
  priority?: boolean;
  /** Fades the frame in the first time it scrolls into view. */
  revealed?: boolean;
  screenshot: Screenshot;
  sizes: string;
};

/** An application screenshot in a quiet window frame, sized up front so it never shifts layout. */
function LandingScreenshot({
  className,
  priority = false,
  revealed = false,
  screenshot,
  sizes,
}: LandingScreenshotProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border bg-card p-1 shadow-2xl shadow-black/15 sm:p-1.5 dark:shadow-black/50",
        className,
      )}
      {...(revealed ? reveal : undefined)}
    >
      <img
        alt={screenshot.alt}
        className="block h-auto w-full rounded-lg"
        decoding="async"
        fetchPriority={priority ? "high" : "auto"}
        height={screenshot.height}
        loading={priority ? "eager" : "lazy"}
        sizes={sizes}
        src={screenshot.src}
        srcSet={screenshot.srcSet}
        width={screenshot.width}
      />
    </div>
  );
}

export { LandingScreenshot };

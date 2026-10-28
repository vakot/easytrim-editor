import { Star } from "lucide-react";

import { GithubIcon } from "@easytrim-editor/ui/brand-icons";
import { Button } from "@easytrim-editor/ui/button";

import { REPOSITORY_URL } from "../consts/links.consts";
import { useGithubData } from "../hooks/useGithubData";
import { fetchStarCount } from "../lib/github-api.utils";

const starCountFormat = new Intl.NumberFormat("en", {
  maximumFractionDigits: 1,
  notation: "compact",
});

/** The repository link with its live star count, which is left out if GitHub cannot be reached. */
function LandingGithubButton() {
  const { state } = useGithubData(fetchStarCount);
  const count = state.status === "ready" ? state.data : undefined;
  const stars = count === undefined ? undefined : starCountFormat.format(count);

  return (
    <Button asChild className="gap-2 max-sm:px-2" size="lg" variant="outline">
      <a
        aria-label={
          stars === undefined ? "GitHub" : `GitHub, ${stars} ${count === 1 ? "star" : "stars"}`
        }
        href={REPOSITORY_URL}
        title="View EasyTrim Editor on GitHub"
      >
        <GithubIcon />
        {/* Icon and count only on phones, where the header is narrow. */}
        <span className="max-sm:hidden">GitHub</span>
        {state.status !== "error" && (
          <>
            <span aria-hidden="true" className="h-4 w-px bg-border max-sm:hidden" />
            <Star aria-hidden="true" className="text-muted-foreground" />
            {stars !== undefined ? (
              <span className="tabular-nums">{stars}</span>
            ) : (
              <span
                aria-hidden="true"
                className="h-3 w-4 rounded-sm bg-muted motion-safe:animate-pulse"
              />
            )}
          </>
        )}
      </a>
    </Button>
  );
}

export { LandingGithubButton };

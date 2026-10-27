import { Download } from "lucide-react";

import { GithubIcon } from "@easytrim-editor/ui/brand-icons";
import { Button } from "@easytrim-editor/ui/button";

import { DOWNLOAD_URL, REPOSITORY_URL } from "../consts/links.consts";

const sections = [
  { href: "#features", label: "Features" },
  { href: "#screens", label: "Screens" },
  { href: "#achievements", label: "Achievements" },
] as const;

function LandingHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <a
          className="flex items-center gap-2.5 rounded-md font-semibold tracking-tight outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          href="#top"
        >
          <img
            alt=""
            className="size-7"
            height={28}
            src={`${import.meta.env.BASE_URL}logo-symbol.svg`}
            width={28}
          />
          EasyTrim Editor
        </a>

        <nav aria-label="Sections" className="hidden md:block">
          <ul className="flex items-center gap-1 text-sm text-muted-foreground">
            {sections.map((section) => (
              <li key={section.href}>
                <a
                  className="rounded-md px-3 py-2 transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                  href={section.href}
                >
                  {section.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Button asChild size="icon-lg" variant="ghost">
            <a aria-label="View EasyTrim Editor on GitHub" href={REPOSITORY_URL}>
              <GithubIcon />
            </a>
          </Button>
          <Button asChild size="lg">
            <a href={DOWNLOAD_URL}>
              <Download aria-hidden="true" />
              Download
            </a>
          </Button>
        </div>
      </div>
    </header>
  );
}

export { LandingHeader };

import { Download } from "lucide-react";

import { GithubIcon } from "@easytrim-editor/ui/brand-icons";
import { Button } from "@easytrim-editor/ui/button";

import { REPOSITORY_URL } from "../consts/links.consts";
import { editorScreenshot } from "../consts/screenshots.consts";

import { LandingScreenshot } from "./LandingScreenshot";

function LandingHero() {
  return (
    <section aria-labelledby="hero-title" className="relative isolate overflow-x-clip" id="top">
      <div aria-hidden="true" className="hero-grid absolute inset-0 -z-10" />

      <div className="mx-auto flex max-w-6xl flex-col items-center px-4 pt-16 text-center sm:px-6 sm:pt-24">
        <p className="mb-6 inline-flex items-center gap-2 rounded-full border bg-card/60 px-3 py-1 text-xs text-muted-foreground motion-safe:animate-in motion-safe:animation-duration-500 motion-safe:fade-in">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-primary" />
          Desktop video trimmer for Windows, macOS, and Linux
        </p>

        <h1
          className="max-w-3xl text-4xl font-bold tracking-tight text-balance motion-safe:animate-in motion-safe:animation-duration-700 motion-safe:fade-in motion-safe:slide-in-from-bottom-3 sm:text-6xl"
          id="hero-title"
        >
          Trim video precisely.{" "}
          <span className="bg-linear-to-r from-primary to-amber-500 bg-clip-text text-transparent dark:to-amber-200">
            Skip the project files.
          </span>
        </h1>

        <p className="mt-6 max-w-2xl text-base text-pretty text-muted-foreground motion-safe:animate-in motion-safe:delay-100 motion-safe:animation-duration-700 motion-safe:fill-mode-both motion-safe:fade-in sm:text-lg">
          EasyTrim Editor is a fast, lightweight editor for making clean clips. Import a video,
          trim, crop, and loop the moment you want, mix its audio, and export it with FFmpeg.
        </p>

        <div className="mt-8 flex flex-col items-center gap-3 motion-safe:animate-in motion-safe:delay-200 motion-safe:animation-duration-700 motion-safe:fill-mode-both motion-safe:fade-in sm:flex-row">
          <Button asChild className="h-11 gap-2 px-5 text-base" size="lg">
            <a href="#downloads">
              <Download aria-hidden="true" className="size-5" />
              Download EasyTrim
            </a>
          </Button>
          <Button asChild className="h-11 gap-2 px-5 text-base" size="lg" variant="outline">
            <a href={REPOSITORY_URL}>
              <GithubIcon className="size-5" />
              View on GitHub
            </a>
          </Button>
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          Free download · Requires FFmpeg and FFprobe on your PATH
        </p>
      </div>

      <div className="relative mx-auto mt-14 max-w-6xl px-4 pb-8 motion-safe:animate-in motion-safe:delay-300 motion-safe:animation-duration-1000 motion-safe:fill-mode-both motion-safe:fade-in motion-safe:slide-in-from-bottom-6 sm:mt-20 sm:px-6">
        <div aria-hidden="true" className="hero-glow absolute -inset-x-8 -top-12 bottom-0 -z-10" />
        <LandingScreenshot
          priority
          screenshot={editorScreenshot}
          sizes="(min-width: 72rem) 70rem, calc(100vw - 2rem)"
        />
      </div>
    </section>
  );
}

export { LandingHero };

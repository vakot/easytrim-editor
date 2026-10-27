import { Download } from "lucide-react";

import { GithubIcon } from "@easytrim-editor/ui/brand-icons";
import { Button } from "@easytrim-editor/ui/button";

import { DOWNLOAD_URL, FFMPEG_DOWNLOAD_URL, REPOSITORY_URL } from "../consts/links.consts";

function LandingDownload() {
  return (
    <section aria-labelledby="download-title" className="px-4 pb-20 sm:px-6 sm:pb-28" id="download">
      <div className="amber-edge relative isolate mx-auto max-w-4xl overflow-hidden rounded-2xl px-6 py-14 text-center sm:px-12 sm:py-20">
        <div aria-hidden="true" className="hero-glow absolute inset-0 -z-10 opacity-60" />
        <img
          alt=""
          className="mx-auto size-14"
          height={56}
          loading="lazy"
          src={`${import.meta.env.BASE_URL}logo-symbol.svg`}
          width={56}
        />
        <h2
          className="mt-6 text-3xl font-bold tracking-tight text-balance sm:text-4xl"
          id="download-title"
        >
          Ready for your next clip?
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
          Installers for Windows, macOS, and Linux are on the latest GitHub release.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild className="h-11 gap-2 px-5 text-base" size="lg">
            <a href={DOWNLOAD_URL}>
              <Download aria-hidden="true" className="size-5" />
              Download the latest release
            </a>
          </Button>
          <Button asChild className="h-11 gap-2 px-5 text-base" size="lg" variant="ghost">
            <a href={REPOSITORY_URL}>
              <GithubIcon className="size-5" />
              Source on GitHub
            </a>
          </Button>
        </div>

        <p className="mx-auto mt-8 max-w-md text-xs leading-relaxed text-muted-foreground">
          EasyTrim uses the FFmpeg and FFprobe already on your system and does not bundle them.{" "}
          <a
            className="rounded-sm text-foreground underline underline-offset-4 outline-none hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50"
            href={FFMPEG_DOWNLOAD_URL}
          >
            Get FFmpeg
          </a>
        </p>
      </div>
    </section>
  );
}

export { LandingDownload };

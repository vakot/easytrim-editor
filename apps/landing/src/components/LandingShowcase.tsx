import { Check } from "lucide-react";

import { queueScreenshot, timelineScreenshot } from "../consts/screenshots.consts";

import { LandingScreenshot } from "./LandingScreenshot";

const queuePoints = [
  "Queue a lossless cut and an optimized copy of the same segment",
  "Remove a job before it runs",
  "Start the queue when you are ready",
] as const;

function LandingShowcase() {
  return (
    <section
      aria-labelledby="screens-title"
      className="scroll-mt-16 border-y border-border/60 bg-card/30 py-20 sm:py-28"
      id="screens"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold tracking-widest text-primary uppercase">Screens</p>
          <h2
            className="mt-3 text-3xl font-bold tracking-tight text-balance sm:text-4xl"
            id="screens-title"
          >
            Built around the clip you are making.
          </h2>
        </div>

        <figure className="mt-12">
          <LandingScreenshot
            screenshot={timelineScreenshot}
            sizes="(min-width: 72rem) 70rem, calc(100vw - 2rem)"
          />
          <figcaption className="mt-6 grid gap-2 sm:grid-cols-[1fr_2fr] sm:gap-8">
            <span className="text-lg font-semibold">A timeline made for the cut</span>
            <span className="text-muted-foreground">
              The selected segment, its timecodes, and every audio track&rsquo;s waveform sit
              together, so you always know exactly what you are about to export.
            </span>
          </figcaption>
        </figure>

        <div className="mt-20 grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <h3 className="text-2xl font-bold tracking-tight">Queue it and keep going</h3>
            <p className="mt-4 text-muted-foreground">
              Fast and Optimized exports wait in one queue beside their source and run one at a
              time, so the editor stays responsive while FFmpeg works.
            </p>
            <ul className="mt-6 grid gap-3 text-sm">
              {queuePoints.map((point) => (
                <li className="flex gap-3" key={point}>
                  <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
                  {point}
                </li>
              ))}
            </ul>
          </div>
          <LandingScreenshot
            className="mx-auto w-full max-w-lg"
            screenshot={queueScreenshot}
            sizes="(min-width: 64rem) 32rem, calc(100vw - 2rem)"
          />
        </div>
      </div>
    </section>
  );
}

export { LandingShowcase };

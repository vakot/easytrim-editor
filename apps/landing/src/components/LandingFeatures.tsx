import { AudioLines, Crop, ListOrdered, type LucideIcon, Play, Scissors, Zap } from "lucide-react";

import { cn } from "@easytrim-editor/ui/class-names";

type Feature = {
  className: string;
  description: string;
  icon: LucideIcon;
  title: string;
};

/** The six capabilities, laid out as two rows of three on large screens. */
const features: readonly Feature[] = [
  {
    className: "lg:col-span-2",
    description:
      "Set in and out points on a frame-accurate timeline with timecodes and keyboard shortcuts.",
    icon: Scissors,
    title: "Precise trimming",
  },
  {
    className: "lg:col-span-2",
    description:
      "Play just the selected segment or loop it, step frame by frame, and change playback speed.",
    icon: Play,
    title: "Playback",
  },
  {
    className: "lg:col-span-2",
    description:
      "Crop the frame to a new size, then move and resize the selected segment until it is exactly right.",
    icon: Crop,
    title: "Crop and segment editing",
  },
  {
    className: "lg:col-span-2",
    description:
      "See every audio track as a waveform, choose which ones to keep, and adjust volume, sync, and filters.",
    icon: AudioLines,
    title: "Audio controls and mixing",
  },
  {
    className: "lg:col-span-2",
    description:
      "Fast Export cuts without re-encoding for an instant lossless clip. Optimized Export re-encodes with FFmpeg for a smaller file.",
    icon: Zap,
    title: "Fast or Optimized Export",
  },
  {
    className: "lg:col-span-2",
    description:
      "Line up as many export jobs as you need. They run one at a time while you keep working on the next clip or grab a coffee.",
    icon: ListOrdered,
    title: "Export Queue",
  },
];

function LandingFeatures() {
  return (
    <section aria-labelledby="features-title" className="scroll-mt-16 py-20 sm:py-28" id="features">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold tracking-widest text-primary uppercase">Features</p>
          <h2
            className="mt-3 text-3xl font-bold tracking-tight text-balance sm:text-4xl"
            id="features-title"
          >
            Everything a quick cut needs. Nothing it doesn&rsquo;t.
          </h2>
          <p className="mt-4 text-muted-foreground">
            No timelines to manage and no projects to save. Open a video, make the clip, and move
            on.
          </p>
        </div>

        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          {features.map(({ className, description, icon: Icon, title }) => (
            <li
              className={cn(
                "group rounded-xl border bg-card p-6 transition-colors hover:border-primary/40",
                className,
              )}
              key={title}
            >
              <span
                aria-hidden="true"
                className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20 [&_svg]:size-5"
              >
                <Icon />
              </span>
              <h3 className="mt-5 font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export { LandingFeatures };

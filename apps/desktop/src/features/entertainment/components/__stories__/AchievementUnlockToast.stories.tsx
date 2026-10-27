import "@/i18n/config";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { AchievementUnlockToast } from "@easytrim-editor/ui/achievement-unlock-toast";
import { Button } from "@easytrim-editor/ui/button";

import { ANNOUNCEMENT_GAP_MS } from "../../consts/achievement-toast.consts";
import { useAchievementAnnouncementQueue } from "../../hooks/useAchievementAnnouncementQueue";
import { createAchievementAnnouncements } from "../../lib/achievement-announcements.utils";
import { AchievementToaster } from "../AchievementToaster";

/** Real registry achievements, one per variant, so the stories use production copy and icons. */
const variantAchievements = {
  bronze: "gif-creator-bronze",
  gold: "storage-saver-gold",
  secret: "the-chosen-one",
  silver: "audio-specialist-silver",
  standard: "fine-tuning",
} as const;

/** Ascending in intensity, as one batch would unlock them. */
const allVariants = [
  variantAchievements.standard,
  variantAchievements.bronze,
  variantAchievements.silver,
  variantAchievements.gold,
  variantAchievements.secret,
];

type StageProps = {
  /** Forces reduced motion on; the system preference always applies as well. */
  reducedMotion: boolean;
  soundEnabled: boolean;
  /** Overrides the toolbar's color scheme; "toolbar" leaves it alone. */
  theme: "dark" | "light" | "toolbar";
};

const defaultStageProps: StageProps = {
  reducedMotion: false,
  soundEnabled: true,
  theme: "toolbar",
};

/** Applies the theme control on top of the toolbar's, and restores the toolbar's when it is reset. */
function ThemeOverride({ theme }: Pick<StageProps, "theme">) {
  useEffect(() => {
    if (theme === "toolbar") return;
    const root = document.documentElement;
    const previous = {
      colorScheme: root.style.colorScheme,
      dark: root.classList.contains("dark"),
      theme: root.dataset.theme,
    };

    root.classList.toggle("dark", theme === "dark");
    root.classList.toggle("light", theme === "light");
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    return () => {
      root.classList.toggle("dark", previous.dark);
      root.classList.toggle("light", !previous.dark);
      root.dataset.theme = previous.theme ?? (previous.dark ? "dark" : "light");
      root.style.colorScheme = previous.colorScheme;
    };
  }, [theme]);

  return null;
}

type TimelineEntry = { closedAt: number | null; shownAt: number; title: string; variant: string };

const toastSelector = "[data-slot='achievement-unlock-toast']";

/** Records when each unlock toast appears and disappears, to verify order and spacing on screen. */
function useToastTimeline() {
  const [entries, setEntries] = useState<TimelineEntry[]>([]);

  useEffect(() => {
    const start = performance.now();
    const indexes = new Map<Element, number>();
    const toasts = (node: Node) =>
      node instanceof Element
        ? [...(node.matches(toastSelector) ? [node] : []), ...node.querySelectorAll(toastSelector)]
        : [];

    const observer = new MutationObserver((mutations) => {
      const now = (performance.now() - start) / 1000;
      for (const mutation of mutations) {
        for (const added of mutation.addedNodes) {
          for (const toast of toasts(added)) {
            if (indexes.has(toast)) continue;
            const title = toast.querySelector("[data-slot='achievement-unlock-title']");
            const entry = {
              closedAt: null,
              shownAt: now,
              title: (title?.querySelector(".sr-only") ?? title)?.textContent ?? "",
              variant: (toast as HTMLElement).dataset.variant ?? "",
            };

            setEntries((current) => {
              indexes.set(toast, current.length);
              return [...current, entry];
            });
          }
        }
        for (const removed of mutation.removedNodes) {
          for (const toast of toasts(removed)) {
            const index = indexes.get(toast);
            if (index === undefined) continue;
            setEntries((current) =>
              current.map((entry, position) =>
                position === index ? { ...entry, closedAt: now } : entry,
              ),
            );
          }
        }
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return entries;
}

function Timeline() {
  const entries = useToastTimeline();
  const seconds = (value: number) => `${value.toFixed(1)}s`;

  return (
    <ol aria-label="Unlock timeline" className="grid max-w-md gap-1 text-xs text-muted-foreground">
      {entries.length === 0 ? <li>Waiting for the first unlock…</li> : null}
      {entries.map((entry, index) => {
        const previousClosedAt = entries[index - 1]?.closedAt;
        return (
          <li key={`${entry.title}-${entry.shownAt}`}>
            {index + 1}. {entry.title} ({entry.variant}) shown at {seconds(entry.shownAt)}
            {entry.closedAt === null ? "" : `, closed at ${seconds(entry.closedAt)}`}
            {previousClosedAt
              ? ` · ${seconds(entry.shownAt - previousClosedAt)} after the previous one closed`
              : ""}
          </li>
        );
      })}
    </ol>
  );
}

type Arrival = { afterMs: number; ids: readonly string[] };

/**
 * Feeds unlocks into the production announcement queue, so the toast, confetti, sound, and spacing
 * are exactly what the application plays. Remounting it, as Replay does, starts from a fresh queue.
 */
function Playback({
  arrivals = [],
  ids,
  settings,
}: {
  arrivals?: readonly Arrival[];
  ids: readonly string[];
  settings: Pick<StageProps, "reducedMotion" | "soundEnabled">;
}) {
  const { t } = useTranslation();
  const enqueue = useAchievementAnnouncementQueue(settings);

  useEffect(() => {
    enqueue(createAchievementAnnouncements(ids, t));
    const timers = arrivals.map(({ afterMs, ids: arrivalIds }) =>
      setTimeout(() => enqueue(createAchievementAnnouncements(arrivalIds, t)), afterMs),
    );

    return () => timers.forEach(clearTimeout);
  }, [arrivals, enqueue, ids, t]);

  return null;
}

type DemoProps = StageProps & {
  /** Unlocks that arrive after the first batch started, to exercise a busy queue. */
  arrivals?: readonly Arrival[];
  /** The achievements unlocked together when the story starts or is replayed. */
  ids: readonly string[];
  /** Explains what the story demonstrates. */
  note?: string;
  /** Lists when each toast showed and closed, to verify order and spacing on screen. */
  timeline?: boolean;
};

function AchievementUnlockDemo({ arrivals, ids, note, timeline = false, ...settings }: DemoProps) {
  const [playback, setPlayback] = useState({ ids, run: 0 });
  const replay = (nextIds: readonly string[]) =>
    setPlayback((current) => ({ ids: nextIds, run: current.run + 1 }));

  return (
    <div className="flex min-h-screen w-full flex-col gap-4 bg-background p-8">
      <ThemeOverride theme={settings.theme} />
      <AchievementToaster />
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => replay(ids)}>Replay</Button>
        <Button onClick={() => replay(allVariants)} variant="outline">
          Trigger all five in sequence
        </Button>
      </div>
      {note ? <p className="max-w-md text-xs text-muted-foreground">{note}</p> : null}
      {timeline ? <Timeline key={playback.run} /> : null}
      <Playback arrivals={arrivals} ids={playback.ids} key={playback.run} settings={settings} />
    </div>
  );
}

function GlyphRevealDemo({ reducedMotion, theme }: StageProps) {
  const { t } = useTranslation();
  const [run, setRun] = useState(0);
  const [announcement] = createAchievementAnnouncements([variantAchievements.secret], t);

  return (
    <div className="flex min-h-screen w-full flex-col items-start gap-4 bg-background p-8">
      <ThemeOverride theme={theme} />
      <Button onClick={() => setRun((current) => current + 1)}>Replay reveal</Button>
      <div className="w-89 max-w-full">
        {announcement ? (
          <AchievementUnlockToast
            announcement={announcement}
            key={run}
            reducedMotion={reducedMotion}
          />
        ) : null}
      </div>
      <p className="max-w-md text-xs text-muted-foreground">
        The title resolves from Galactic Glyphs first, then the description, then a final shimmer
        passes over the finished toast. The layout never shifts, and screen readers read the real
        text from the start.
      </p>
    </div>
  );
}

const meta = {
  args: { ...defaultStageProps, ids: [variantAchievements.standard] },
  argTypes: {
    arrivals: { table: { disable: true } },
    ids: { table: { disable: true } },
    note: { table: { disable: true } },
    reducedMotion: { control: "boolean" },
    soundEnabled: { control: "boolean" },
    theme: { control: { type: "inline-radio" }, options: ["toolbar", "light", "dark"] },
    timeline: { table: { disable: true } },
  },
  component: AchievementUnlockDemo,
  parameters: { layout: "fullscreen" },
  title: "Features/Entertainment/Achievement Unlock Toast",
} satisfies Meta<typeof AchievementUnlockDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The default themed toast with a small confetti burst and the standard chime. */
export const StandardAchievement: Story = { args: { ids: [variantAchievements.standard] } };

/** Bronze colors, a small burst, the standard chime, and a subtle accent on the icon. */
export const BronzeAchievement: Story = { args: { ids: [variantAchievements.bronze] } };

/** Silver colors, a medium burst, the standard chime, and a more pronounced entrance. */
export const SilverAchievement: Story = { args: { ids: [variantAchievements.silver] } };

/** Gold colors, a large burst, the standard chime, and an expressive entrance with a halo. */
export const GoldAchievement: Story = { args: { ids: [variantAchievements.gold] } };

/** Red diagonal TOP SECRET ribbon, iridescent glow and shimmer, and the glyph reveal. */
export const SecretAchievement: Story = { args: { ids: [variantAchievements.secret] } };

/** The secret toast on a phone-sized viewport; the toolbar's viewport menu tests other sizes. */
export const SecretOnCompactViewport: Story = {
  args: { ids: [variantAchievements.secret] },
  globals: { viewport: { isRotated: false, value: "mobile1" } },
};

/** The complete Galactic Glyphs to text transformation of the title and then the description. */
export const SecretGlyphReveal: Story = {
  render: (args) => <GlyphRevealDemo {...args} />,
};

/** Standard, Bronze, Silver, Gold, and Secret, each with its own toast and sound, 1.5s apart. */
export const SequentialUnlocks: Story = {
  args: {
    ids: allVariants,
    note: `Plays in unlock order. Each toast appears about ${ANNOUNCEMENT_GAP_MS / 1000} seconds after the previous one appeared. Earlier toasts stay open and stack; sounds do not overlap.`,
    timeline: true,
  },
};

const rapidArrivals: readonly Arrival[] = [
  { afterMs: 600, ids: [variantAchievements.silver] },
  { afterMs: 1_500, ids: [variantAchievements.gold, variantAchievements.standard] },
  { afterMs: 3_000, ids: [variantAchievements.secret] },
];

/** More unlocks arrive while the first toast is still showing; all of them queue up in order. */
export const RapidUnlocks: Story = {
  args: {
    arrivals: rapidArrivals,
    ids: [variantAchievements.bronze],
    note: "Bronze starts, then Silver, Gold with Standard, and Secret arrive within three seconds. None overlap, disappear, or repeat.",
    timeline: true,
  },
};

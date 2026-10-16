import "@/i18n/config";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMemo } from "react";
import { Provider } from "react-redux";

import { achievementRecordsLoaded } from "@/app/store/slices/achievements-slice";
import {
  usageStatisticsLoaded,
  usageStatisticsRequested,
} from "@/app/store/slices/usage-statistics-slice";
import { createAppStore } from "@/app/store/store";
import type { AchievementRecords } from "@/domain/achievement-records";
import {
  completeAchievementRecords,
  emptyAchievementRecords,
} from "@/test/achievement-records.fixtures";
import { emptyUsageStatistics } from "@/test/usage-statistics.fixtures";

import { defaultAchievementSecretStyle } from "../../../consts/achievement-secret-style.consts";
import { achievementCollection } from "../../../consts/achievements.consts";
import type {
  AchievementSecretStyle,
  AchievementSecretVariant,
} from "../../../types/achievements.types";
import { AchievementSeriesItem } from "../components/AchievementSeriesItem";
import { AchievementStandaloneItem } from "../components/AchievementStandaloneItem";
import { AchievementSecretStyleContext } from "../contexts/AchievementSecretStyleContext";

import { deriveAchievementRecords } from "./achievement-story.utils";

type CardState = "bronze" | "gold" | "locked" | "secret-locked" | "secret-unlocked" | "silver";

const cardStates = [
  "locked",
  "bronze",
  "silver",
  "gold",
  "secret-locked",
  "secret-unlocked",
] as const satisfies CardState[];

const variantLabels: Record<AchievementSecretVariant, string> = {
  "animated-gradient": "2. Animated Gradient",
  "prismatic-holographic": "4. Prismatic / Holographic",
  "rotating-highlight": "3. Rotating Border Highlight",
  "static-iridescent": "1. Static Iridescent",
};

const achievementSecretVariants = Object.keys(variantLabels) as AchievementSecretVariant[];

const exportMastery = findEntry("export-mastery", "series");
const chosenOne = findEntry("the-chosen-one", "standalone");

function findEntry<Kind extends "series" | "standalone">(
  id: string,
  kind: Kind,
): Extract<(typeof achievementCollection)[number], { kind: Kind }> {
  for (const entry of achievementCollection) {
    if (entry.id === id && entry.kind === kind)
      return entry as Extract<(typeof achievementCollection)[number], { kind: Kind }>;
  }
  throw new Error(`Unknown ${kind} achievement ${id}`);
}

const legendaryIds = completeAchievementRecords.discoveredSplashMessageIds;

/** Completed exports that put Export Mastery at exactly Bronze, Silver, or Gold. */
const exportsByTier = { bronze: 3, gold: 120, silver: 40 };

function statisticsFor(state: CardState) {
  return state === "bronze" || state === "silver" || state === "gold"
    ? { ...emptyUsageStatistics, optimizedExports: exportsByTier[state] }
    : emptyUsageStatistics;
}

function recordsFor(state: CardState): AchievementRecords {
  switch (state) {
    case "bronze":
    case "gold":
    case "silver":
      return deriveAchievementRecords(statisticsFor(state));
    case "locked":
      return emptyAchievementRecords;
    case "secret-locked":
      return { ...emptyAchievementRecords, discoveredSplashMessageIds: legendaryIds.slice(0, 4) };
    case "secret-unlocked":
      return deriveAchievementRecords(emptyUsageStatistics, {
        discoveredSplashMessageIds: legendaryIds,
      });
  }
}

/** The real achievement card for a state, in a store seeded like the application's. */
function StoryCard({ state, style }: { state: CardState; style: AchievementSecretStyle }) {
  const store = useMemo(() => {
    const appStore = createAppStore();
    appStore.dispatch(achievementRecordsLoaded({ records: recordsFor(state), requestId: "story" }));
    appStore.dispatch(usageStatisticsRequested({ requestId: "story" }));
    appStore.dispatch(
      usageStatisticsLoaded({ requestId: "story", statistics: statisticsFor(state) }),
    );
    return appStore;
  }, [state]);

  return (
    <Provider store={store}>
      <AchievementSecretStyleContext.Provider value={style}>
        <div role="list">
          {state.startsWith("secret") ? (
            <AchievementStandaloneItem definition={chosenOne} />
          ) : (
            <AchievementSeriesItem series={exportMastery} />
          )}
        </div>
      </AchievementSecretStyleContext.Provider>
    </Provider>
  );
}

type PlaygroundArgs = Omit<AchievementSecretStyle, "thickness"> & {
  borderThickness: number;
  cardState: CardState;
  width: string;
};

function Playground({ borderThickness, cardState, width, ...style }: PlaygroundArgs) {
  return (
    <div className="bg-card p-6" style={{ width }}>
      <StoryCard state={cardState} style={{ ...style, thickness: borderThickness }} />
    </div>
  );
}

type ComparisonArgs = Omit<PlaygroundArgs, "cardState" | "variant">;

function Comparison({ borderThickness, width, ...rest }: ComparisonArgs) {
  const style = { ...rest, thickness: borderThickness };

  return (
    <div className="grid gap-x-6 gap-y-5 bg-card p-6" style={{ width }}>
      <section className="grid gap-2">
        <h3 className="text-xs font-medium text-muted-foreground">Tiered reference</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {(["locked", "bronze", "silver", "gold"] as const).map((state) => (
            <StoryCard
              key={state}
              state={state}
              style={{ ...style, variant: "static-iridescent" }}
            />
          ))}
        </div>
      </section>
      {achievementSecretVariants.map((variant) => (
        <section className="grid gap-2" key={variant}>
          <h3 className="text-xs font-medium text-muted-foreground">{variantLabels[variant]}</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <StoryCard state="secret-unlocked" style={{ ...style, variant }} />
            <StoryCard state="secret-locked" style={{ ...style, variant }} />
          </div>
        </section>
      ))}
    </div>
  );
}

const sharedArgTypes = {
  animated: {
    control: "boolean",
    description: "Plays the variant motion. `prefers-reduced-motion` always wins.",
  },
  borderThickness: {
    control: { max: 6, min: 1, step: 0.5, type: "range" },
    description: "Border thickness in pixels (a locked secret stays at most 1px).",
  },
  glow: {
    control: { max: 1, min: 0, step: 0.05, type: "range" },
    description: "Glow intensity of an unlocked secret.",
  },
  iridescentIcon: {
    control: "boolean",
    description: "Strokes the icon with the gradient instead of one color.",
  },
  width: { control: "text" },
} as const;

const meta = {
  args: {
    animated: defaultAchievementSecretStyle.animated,
    borderThickness: defaultAchievementSecretStyle.thickness,
    cardState: "secret-unlocked",
    glow: defaultAchievementSecretStyle.glow,
    iridescentIcon: defaultAchievementSecretStyle.iridescentIcon,
    variant: defaultAchievementSecretStyle.variant,
    width: "34rem",
  },
  argTypes: {
    ...sharedArgTypes,
    cardState: {
      control: "select",
      description: "Which achievement card to render.",
      options: cardStates,
    },
    variant: {
      control: "select",
      description: "Secret visual variant (applies to Secret Locked and Secret Unlocked).",
      options: achievementSecretVariants,
    },
  },
  component: Playground,
  parameters: { layout: "centered" },
  title: "Features/Entertainment/Achievement Secret Styles",
} satisfies Meta<typeof Playground>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Real cards with every styling input exposed as a control; compare variants without editing code. */
export const Interactive: Story = {};

export const StaticIridescent: Story = { args: { variant: "static-iridescent" } };

export const AnimatedGradient: Story = { args: { variant: "animated-gradient" } };

export const RotatingBorderHighlight: Story = { args: { variant: "rotating-highlight" } };

export const PrismaticHolographic: Story = { args: { variant: "prismatic-holographic" } };

/** Every secret variant, unlocked and locked, beside regular tiered cards. */
export const AllVariants: StoryObj<typeof Comparison> = {
  args: {
    animated: true,
    borderThickness: 2,
    glow: 0.6,
    iridescentIcon: true,
    width: "62rem",
  },
  argTypes: sharedArgTypes,
  parameters: { layout: "fullscreen" },
  render: (args) => <Comparison {...args} />,
};

/** The same comparison with animation off, as with `prefers-reduced-motion: reduce`. */
export const AllVariantsStatic: StoryObj<typeof Comparison> = {
  ...AllVariants,
  args: { ...AllVariants.args, animated: false },
};

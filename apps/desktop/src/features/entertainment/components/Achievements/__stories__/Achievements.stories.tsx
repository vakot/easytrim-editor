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
import type { UsageStatistics } from "@/domain/usage-statistics";
import {
  completeAchievementRecords,
  emptyAchievementRecords,
} from "@/test/achievement-records.fixtures";
import { emptyUsageStatistics } from "@/test/usage-statistics.fixtures";

import { Achievements, AchievementsCollection, AchievementsSummary } from "../Achievements";

const MINUTE = 60_000;
const MEGABYTE = 1_024 ** 2;
const GIGABYTE = 1_024 ** 3;

const seriesIds = [
  "audio-specialist",
  "data-cruncher",
  "export-mastery",
  "gif-creator",
  "lossless-precision",
  "storage-saver",
  "time-well-spent",
];

/** Unlocks every series up to and including `tier`. */
function recordsUpTo(tier: "bronze" | "gold" | "silver"): AchievementRecords {
  const tiers = ["bronze", "silver", "gold"].slice(
    0,
    ["bronze", "silver", "gold"].indexOf(tier) + 1,
  );

  return {
    discoveredSplashMessageIds: ["rainbow-mode"],
    unlockedAchievements: Object.fromEntries(
      seriesIds.flatMap((id, index) =>
        tiers.map((unlocked, tierIndex) => [
          `${id}-${unlocked}`,
          Date.UTC(2026, tierIndex * 3, 2 + index, 12),
        ]),
      ),
    ),
    viewedAtMillis: Date.UTC(2026, 9, 1),
  };
}

/** Statistics that reach Bronze, Silver, or Gold of every series and progress beyond it. */
const statisticsByTier: Record<"bronze" | "gold" | "silver", UsageStatistics> = {
  bronze: {
    ...emptyUsageStatistics,
    audioExports: 3,
    gifExports: 2,
    losslessExports: 6,
    optimizedExports: 1,
    outputBytes: 2 * GIGABYTE,
    processingMillis: 7 * MINUTE,
    sourceBytes: 2.4 * GIGABYTE,
  },
  gold: {
    ...emptyUsageStatistics,
    audioExports: 31,
    gifExports: 28,
    losslessExports: 64,
    optimizedExports: 60,
    outputBytes: 120 * GIGABYTE,
    processingMillis: 95 * MINUTE,
    sourceBytes: 132 * GIGABYTE,
  },
  silver: {
    ...emptyUsageStatistics,
    audioExports: 12,
    gifExports: 9,
    losslessExports: 31,
    optimizedExports: 12,
    outputBytes: 18 * GIGABYTE,
    processingMillis: 38 * MINUTE,
    sourceBytes: 24 * GIGABYTE,
  },
};

function AchievementsStory({
  records,
  statistics,
  width,
}: {
  records: AchievementRecords;
  statistics: UsageStatistics;
  width: string;
}) {
  // Storybook has no native backend, so seed the store; failed refreshes keep these values.
  const store = useMemo(() => {
    const appStore = createAppStore();
    appStore.dispatch(achievementRecordsLoaded({ records, requestId: "story" }));
    appStore.dispatch(usageStatisticsRequested({ requestId: "story" }));
    appStore.dispatch(usageStatisticsLoaded({ requestId: "story", statistics }));
    return appStore;
  }, [records, statistics]);

  return (
    <Provider store={store}>
      <div className="flex h-160 flex-col gap-2 border bg-card px-4 pt-4" style={{ width }}>
        <Achievements>
          <AchievementsSummary />
          <AchievementsCollection className="flex-1" />
        </Achievements>
      </div>
    </Provider>
  );
}

const meta = {
  args: {
    records: {
      discoveredSplashMessageIds: ["rainbow-mode", "chosen-frame"],
      unlockedAchievements: {
        "data-cruncher-bronze": Date.UTC(2026, 1, 3, 9),
        "export-mastery-bronze": Date.UTC(2026, 0, 15, 12),
        "export-mastery-silver": Date.UTC(2026, 1, 3, 9),
        "gif-creator-bronze": Date.UTC(2026, 3, 22, 17),
        "lossless-precision-bronze": Date.UTC(2026, 0, 15, 12),
        "lossless-precision-gold": Date.UTC(2026, 8, 30, 20),
        "lossless-precision-silver": Date.UTC(2026, 2, 1, 10),
        "time-well-spent-bronze": Date.UTC(2026, 0, 15, 12),
        "time-well-spent-silver": Date.UTC(2026, 4, 9, 20),
      },
      // Viewed in April: the later unlocks are marked new.
      viewedAtMillis: Date.UTC(2026, 3, 1),
    },
    statistics: {
      ...emptyUsageStatistics,
      gifExports: 3,
      losslessExports: 52,
      optimizedExports: 16,
      outputBytes: 3 * GIGABYTE,
      processingMillis: 41 * MINUTE,
      sourceBytes: 3 * GIGABYTE + 60 * MEGABYTE,
    },
    width: "40rem",
  },
  component: AchievementsStory,
  parameters: { layout: "centered" },
  title: "Features/Entertainment/Achievements",
} satisfies Meta<typeof AchievementsStory>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Series at different tiers, one completed at Gold, with unlocks since the last view marked new. */
export const Mixed: Story = {};

export const Locked: Story = {
  args: { records: emptyAchievementRecords, statistics: emptyUsageStatistics },
};

export const Bronze: Story = {
  args: { records: recordsUpTo("bronze"), statistics: statisticsByTier.bronze },
};

export const Silver: Story = {
  args: { records: recordsUpTo("silver"), statistics: statisticsByTier.silver },
};

export const Gold: Story = {
  args: { records: recordsUpTo("gold"), statistics: statisticsByTier.gold },
};

export const FullyUnlocked: Story = {
  args: { records: completeAchievementRecords, statistics: statisticsByTier.gold },
};

/** Four of the five legendary splash messages discovered: The Chosen One stays concealed. */
export const SecretLocked: Story = {
  args: {
    records: {
      ...recordsUpTo("bronze"),
      discoveredSplashMessageIds: [
        "chosen-frame",
        "corrupted-signal",
        "enchantment-table",
        "rainbow-mode",
      ],
    },
    statistics: statisticsByTier.bronze,
  },
};

export const SecretUnlocked: Story = {
  args: {
    records: {
      discoveredSplashMessageIds: completeAchievementRecords.discoveredSplashMessageIds,
      unlockedAchievements: {
        ...recordsUpTo("bronze").unlockedAchievements,
        "the-chosen-one": Date.UTC(2026, 9, 16, 21),
      },
      viewedAtMillis: Date.UTC(2026, 9, 1),
    },
    statistics: statisticsByTier.bronze,
  },
};

export const Narrow: Story = { args: { width: "20rem" } };

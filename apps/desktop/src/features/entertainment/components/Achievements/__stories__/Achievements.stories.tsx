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
  completeAchievementStatistics,
  emptyAchievementRecords,
  partiallyUnlockedAchievementScenario,
} from "@/test/achievement-records.fixtures";
import { emptyUsageStatistics } from "@/test/usage-statistics.fixtures";

import { Achievements, AchievementsCollection, AchievementsSummary } from "../Achievements";

import { deriveAchievementRecords } from "./achievement-story.utils";

const MINUTE = 60_000;
const GIGABYTE = 1_024 ** 3;

/**
 * Statistics that put every series in Bronze, Silver, or Gold without reaching the next tier. The
 * records of each story are derived from them, so every reached threshold is unlocked.
 */
const statisticsByTier: Record<"bronze" | "gold" | "silver", UsageStatistics> = {
  bronze: {
    ...emptyUsageStatistics,
    audioExports: 2,
    gifExports: 2,
    losslessExports: 3,
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
    ...partiallyUnlockedAchievementScenario,
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

/** All onboarding achievements are waiting for their corresponding first successful actions. */
export const GettingStartedLocked: Story = {
  args: { records: emptyAchievementRecords, statistics: emptyUsageStatistics },
};

/** Shows onboarding cards after each first action, with their persisted unlock timestamps. */
export const GettingStartedUnlocked: Story = {
  args: {
    records: {
      ...emptyAchievementRecords,
      unlockedAchievements: {
        "first-contact": Date.UTC(2026, 9, 12, 18, 30),
        "cut-to-the-chase": Date.UTC(2026, 9, 12, 18, 31),
        "frame-by-frame": Date.UTC(2026, 9, 12, 18, 32),
        "fine-tuning": Date.UTC(2026, 9, 12, 18, 33),
        "queued-up": Date.UTC(2026, 9, 12, 18, 34),
        "shortcut-taken": Date.UTC(2026, 9, 12, 18, 35),
      },
    },
    statistics: { ...emptyUsageStatistics, sourceBytes: 1 },
  },
};

export const Bronze: Story = {
  args: {
    records: deriveAchievementRecords(statisticsByTier.bronze),
    statistics: statisticsByTier.bronze,
  },
};

export const Silver: Story = {
  args: {
    records: deriveAchievementRecords(statisticsByTier.silver),
    statistics: statisticsByTier.silver,
  },
};

export const Gold: Story = {
  args: {
    records: deriveAchievementRecords(statisticsByTier.gold),
    statistics: statisticsByTier.gold,
  },
};

export const FullyUnlocked: Story = {
  args: { records: completeAchievementRecords, statistics: completeAchievementStatistics },
};

/** Four of the five legendary splash messages discovered: The Chosen One stays concealed. */
export const SecretLocked: Story = {
  args: {
    records: deriveAchievementRecords(statisticsByTier.bronze, {
      discoveredSplashMessageIds: [
        "chosen-frame",
        "corrupted-signal",
        "enchantment-table",
        "rainbow-mode",
      ],
    }),
    statistics: statisticsByTier.bronze,
  },
};

export const SecretUnlocked: Story = {
  args: {
    records: deriveAchievementRecords(statisticsByTier.bronze, {
      discoveredSplashMessageIds: completeAchievementRecords.discoveredSplashMessageIds,
    }),
    statistics: statisticsByTier.bronze,
  },
};

/** Bronze and Silver collected, so those collectors are revealed and new while Gold stays concealed. */
export const CollectorsUnlocked: Story = {
  args: {
    records: deriveAchievementRecords(statisticsByTier.silver, {
      unlockedAt: (id, index) =>
        id.endsWith("-collector") ? Date.UTC(2026, 9, 14, 12) : Date.UTC(2026, 0, 2 + index, 12),
      viewedAtMillis: Date.UTC(2026, 9, 10),
    }),
    statistics: statisticsByTier.silver,
  },
};

export const Narrow: Story = { args: { width: "20rem" } };

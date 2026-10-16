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

const GIGABYTE = 1_024 ** 3;
const HOUR = 3_600_000;

const partialStatistics: UsageStatistics = {
  ...emptyUsageStatistics,
  audioExports: 4,
  gifExports: 2,
  losslessExports: 37,
  optimizedExports: 41,
  outputBytes: 9 * GIGABYTE,
  processingMillis: 5 * HOUR + 20 * 60_000,
  sourceBytes: 64 * GIGABYTE,
};

const partialRecords: AchievementRecords = {
  discoveredSplashMessageIds: ["rainbow-mode", "chosen-frame"],
  unlockedAchievements: {
    "first-export": Date.UTC(2026, 0, 15, 12),
    "first-lossless-cut": Date.UTC(2026, 0, 15, 12),
    "getting-started": Date.UTC(2026, 1, 3, 9),
    "gif-maker": Date.UTC(2026, 3, 22, 17),
    "one-hour-later": Date.UTC(2026, 4, 9, 20),
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
  args: { records: partialRecords, statistics: partialStatistics, width: "40rem" },
  component: AchievementsStory,
  parameters: { layout: "centered" },
  title: "Features/Entertainment/Achievements",
} satisfies Meta<typeof AchievementsStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PartiallyUnlocked: Story = {};

export const Empty: Story = {
  args: { records: emptyAchievementRecords, statistics: emptyUsageStatistics },
};

export const FullyUnlocked: Story = {
  args: {
    records: completeAchievementRecords,
    statistics: {
      ...partialStatistics,
      audioExports: 12,
      gifExports: 9,
      losslessExports: 640,
      optimizedExports: 480,
      outputBytes: 120 * GIGABYTE,
      processingMillis: 31 * HOUR,
      sourceBytes: 412 * GIGABYTE,
    },
  },
};

/** Four of the five legendary splash messages discovered: The Chosen One stays concealed. */
export const SecretLocked: Story = {
  args: {
    records: {
      ...partialRecords,
      discoveredSplashMessageIds: [
        "chosen-frame",
        "corrupted-signal",
        "enchantment-table",
        "rainbow-mode",
      ],
    },
  },
};

export const SecretUnlocked: Story = {
  args: {
    records: {
      discoveredSplashMessageIds: completeAchievementRecords.discoveredSplashMessageIds,
      unlockedAchievements: {
        ...partialRecords.unlockedAchievements,
        "the-chosen-one": Date.UTC(2026, 9, 16, 21),
      },
    },
  },
};

/** Progress close to each target, covering every metric unit. */
export const NearlyThere: Story = {
  args: {
    records: emptyAchievementRecords,
    statistics: {
      ...emptyUsageStatistics,
      audioExports: 9,
      losslessExports: 98,
      optimizedExports: 890,
      outputBytes: 140 * GIGABYTE,
      processingMillis: 23 * HOUR + 45 * 60_000,
      sourceBytes: 148 * GIGABYTE,
    },
  },
};

export const Narrow: Story = { args: { width: "20rem" } };

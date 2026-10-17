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
import type { UsageStatistics as UsageStatisticsValue } from "@/domain/usage-statistics";

import {
  UsageStatistics,
  UsageStatisticsContent,
  UsageStatisticsDashboard,
} from "../UsageStatistics";

const storyAchievementRecords = {
  discoveredSplashMessageIds: [],
  unlockedAchievements: { "export-mastery-bronze": Date.UTC(2026, 0, 15, 12) },
  viewedAtMillis: null,
};

function UsageStatisticsStory({ statistics }: { statistics: UsageStatisticsValue }) {
  // Storybook has no native backend, so seed the store; a failed refresh keeps these totals.
  const store = useMemo(() => {
    const appStore = createAppStore();
    appStore.dispatch(usageStatisticsRequested({ requestId: "story" }));
    appStore.dispatch(usageStatisticsLoaded({ requestId: "story", statistics }));
    appStore.dispatch(
      achievementRecordsLoaded({ records: storyAchievementRecords, requestId: "story" }),
    );
    return appStore;
  }, [statistics]);

  return (
    <Provider store={store}>
      <UsageStatistics>
        <UsageStatisticsContent className="px-3">
          <UsageStatisticsDashboard />
        </UsageStatisticsContent>
      </UsageStatistics>
    </Provider>
  );
}

const meta = {
  args: {
    statistics: {
      audioExports: 24,
      firstExportAtMillis: Date.UTC(2026, 0, 15, 12),
      gifExports: 17,
      lastExportAtMillis: Date.UTC(2026, 9, 12, 18, 30),
      longestExportMillis: 17 * 60_000,
      losslessExports: 312,
      optimizedExports: 128,
      outputBytes: 61 * 1_024 ** 3,
      processingMillis: 41 * 3_600_000 + 17 * 60_000,
      sourceBytes: 412 * 1_024 ** 3,
    },
  },
  component: UsageStatisticsStory,
  decorators: [
    (Story) => (
      <div className="flex h-144 w-160 flex-col border bg-card">
        <Story />
      </div>
    ),
  ],
  parameters: { layout: "centered" },
  title: "Features/Entertainment/Usage Statistics",
} satisfies Meta<typeof UsageStatisticsStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

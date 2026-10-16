import "@/i18n/config";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useMemo } from "react";
import { Provider } from "react-redux";

import { Button } from "@/components/ui/button";

import { AppAchievementsDialog } from "@/app/dialogs/AppAchievementsDialog";
import { useAchievementsDialog } from "@/app/hooks/useAppDialog";
import { AppDialogsProvider } from "@/app/providers/AppDialogsProvider";
import { achievementRecordsLoaded } from "@/app/store/slices/achievements-slice";
import {
  usageStatisticsLoaded,
  usageStatisticsRequested,
} from "@/app/store/slices/usage-statistics-slice";
import { createAppStore } from "@/app/store/store";
import { ThemeProvider } from "@/app/theme/ThemeProvider";
import type { AchievementRecords } from "@/domain/achievement-records";
import type { UsageStatistics } from "@/domain/usage-statistics";
import {
  completeAchievementRecords,
  emptyAchievementRecords,
} from "@/test/achievement-records.fixtures";
import { emptyUsageStatistics } from "@/test/usage-statistics.fixtures";

const meta = {
  args: {
    records: {
      discoveredSplashMessageIds: ["rainbow-mode"],
      unlockedAchievements: {
        "first-export": Date.UTC(2026, 0, 15, 12),
        "first-lossless-cut": Date.UTC(2026, 0, 15, 12),
        "getting-started": Date.UTC(2026, 1, 3, 9),
        "one-hour-later": Date.UTC(2026, 4, 9, 20),
      },
    },
    statistics: {
      ...emptyUsageStatistics,
      audioExports: 3,
      losslessExports: 37,
      optimizedExports: 41,
      outputBytes: 9 * 1_024 ** 3,
      processingMillis: 5 * 3_600_000,
      sourceBytes: 64 * 1_024 ** 3,
    },
  },
  component: AppAchievementsDialogStory,
  parameters: { layout: "fullscreen" },
  title: "App/Achievements Dialog",
} satisfies Meta<typeof AppAchievementsDialogStory>;

export default meta;
type Story = StoryObj<typeof meta>;

function AppAchievementsDialogStory({
  records,
  statistics,
}: {
  records: AchievementRecords;
  statistics: UsageStatistics;
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
      <ThemeProvider>
        <AppDialogsProvider>
          <AppAchievementsDialogStoryControls />
          <AppAchievementsDialog />
        </AppDialogsProvider>
      </ThemeProvider>
    </Provider>
  );
}

function AppAchievementsDialogStoryControls() {
  const { openDialog } = useAchievementsDialog();

  useEffect(() => openDialog(), [openDialog]);

  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <Button onClick={openDialog}>Open Achievements</Button>
    </div>
  );
}

export const PartiallyUnlocked: Story = {};

export const Empty: Story = {
  args: { records: emptyAchievementRecords, statistics: emptyUsageStatistics },
};

export const FullyUnlocked: Story = {
  args: { records: completeAchievementRecords },
};

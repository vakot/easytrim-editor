import "@/i18n/config";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useMemo } from "react";
import { Provider } from "react-redux";

import { Button } from "@/components/ui/button";

import { AppStatisticsDialog } from "@/app/dialogs/AppStatisticsDialog";
import { useStatisticsDialog } from "@/app/hooks/useAppDialog";
import { AppDialogsProvider } from "@/app/providers/AppDialogsProvider";
import {
  usageStatisticsLoaded,
  usageStatisticsRequested,
} from "@/app/store/slices/usage-statistics-slice";
import { createAppStore } from "@/app/store/store";
import { ThemeProvider } from "@/app/theme/ThemeProvider";
import type { UsageStatistics } from "@/domain/usage-statistics";
import { emptyUsageStatistics } from "@/test/usage-statistics.fixtures";

const meta = {
  args: {
    statistics: {
      firstExportAtMillis: Date.UTC(2026, 0, 15, 12),
      lastExportAtMillis: Date.UTC(2026, 9, 12, 18, 30),
      losslessExports: 312,
      outputBytes: 61 * 1_024 ** 3,
      processingMillis: 41 * 3_600_000 + 17 * 60_000,
      regularExports: 128,
      sourceBytes: 412 * 1_024 ** 3,
    },
  },
  component: AppStatisticsDialogStory,
  parameters: { layout: "fullscreen" },
  title: "App/Statistics Dialog",
} satisfies Meta<typeof AppStatisticsDialogStory>;

export default meta;
type Story = StoryObj<typeof meta>;

function AppStatisticsDialogStory({ statistics }: { statistics: UsageStatistics }) {
  // Storybook has no native backend, so seed the store; a failed refresh keeps these totals.
  const store = useMemo(() => {
    const appStore = createAppStore();
    appStore.dispatch(usageStatisticsRequested({ requestId: "story" }));
    appStore.dispatch(usageStatisticsLoaded({ requestId: "story", statistics }));
    return appStore;
  }, [statistics]);

  return (
    <Provider store={store}>
      <ThemeProvider>
        <AppDialogsProvider>
          <AppStatisticsDialogStoryControls />
          <AppStatisticsDialog />
        </AppDialogsProvider>
      </ThemeProvider>
    </Provider>
  );
}

function AppStatisticsDialogStoryControls() {
  const { openDialog } = useStatisticsDialog();

  useEffect(() => openDialog(), [openDialog]);

  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <Button onClick={openDialog}>Open Statistics</Button>
    </div>
  );
}

export const Recorded: Story = {};

export const Empty: Story = { args: { statistics: emptyUsageStatistics } };

export const LargerOutputs: Story = {
  args: {
    statistics: {
      firstExportAtMillis: Date.UTC(2026, 9, 1, 9),
      lastExportAtMillis: Date.UTC(2026, 9, 2, 9),
      losslessExports: 0,
      outputBytes: 2_400 * 1_024 ** 2,
      processingMillis: 840_000,
      regularExports: 6,
      sourceBytes: 900 * 1_024 ** 2,
    },
  },
};

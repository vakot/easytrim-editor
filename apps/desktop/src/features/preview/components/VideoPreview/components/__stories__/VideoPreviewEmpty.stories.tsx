import "@/i18n/config";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { useLayoutEffect, useMemo } from "react";
import { Provider } from "react-redux";

import { achievementRecordsUpdated } from "@/app/store/slices/achievements-slice";
import { createAppStore } from "@/app/store/store";
import type { AchievementRecords } from "@/domain/achievement-records";
import {
  completeAchievementRecords,
  emptyAchievementRecords,
  partiallyUnlockedAchievementScenario,
} from "@/test/achievement-records.fixtures";

import { VideoPreviewEmpty } from "../VideoPreviewEmpty";

function EmptyPreviewStory({
  height,
  records,
  scale,
  width,
}: {
  height: string;
  records: AchievementRecords;
  scale: number;
  width: string;
}) {
  const store = useMemo(() => {
    const store = createAppStore();
    store.dispatch(achievementRecordsUpdated({ records }));
    return store;
  }, [records]);

  useLayoutEffect(() => {
    const root = document.documentElement;
    const previous = root.style.fontSize;
    root.style.fontSize = `${scale}%`;
    return () => {
      root.style.fontSize = previous;
    };
  }, [scale]);

  return (
    <Provider store={store}>
      <div className="max-w-full bg-background text-foreground" style={{ height, width }}>
        <VideoPreviewEmpty />
      </div>
    </Provider>
  );
}

const meta = {
  args: { height: "44rem", records: emptyAchievementRecords, scale: 100, width: "80rem" },
  component: EmptyPreviewStory,
  parameters: { layout: "fullscreen" },
  title: "Features/Preview/VideoPreviewEmpty",
} satisfies Meta<typeof EmptyPreviewStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WideLocked: Story = {};
export const WidePartiallyUnlocked: Story = {
  args: { records: partiallyUnlockedAchievementScenario.records },
};
export const WideFullyUnlocked: Story = { args: { records: completeAchievementRecords } };
export const Narrow: Story = { args: { width: "32rem" } };
export const Short: Story = { args: { height: "28rem" } };
/** Adjust scale through 75, 100, 125, 150 and 200; the viewport stays fixed. */
export const Scaling: Story = {
  args: { height: "100vh", records: completeAchievementRecords, width: "100vw" },
  argTypes: { scale: { control: { type: "select" }, options: [75, 100, 125, 150, 200] } },
};

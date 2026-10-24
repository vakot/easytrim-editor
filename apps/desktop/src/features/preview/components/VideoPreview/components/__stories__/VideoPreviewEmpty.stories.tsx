import "@/i18n/config";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { type ComponentProps, useLayoutEffect, useMemo, useState } from "react";
import { Provider } from "react-redux";

import { Button } from "@easytrim-editor/ui/button";

import { achievementRecordsUpdated } from "@/app/store/slices/achievements-slice";
import { createAppStore } from "@/app/store/store";
import type { AchievementRecords } from "@/domain/achievement-records";
import { STORAGE_KEYS } from "@/lib/storage.consts";
import {
  almostCompleteGettingStartedRecords,
  completeAchievementRecords,
  emptyAchievementRecords,
  partiallyUnlockedAchievementScenario,
} from "@/test/achievement-records.fixtures";

import { VideoPreviewEmpty } from "../VideoPreviewEmpty";

function EmptyPreviewStory(props: Omit<ComponentProps<typeof EmptyPreviewSession>, "onReset">) {
  const [replay, setReplay] = useState(0);
  return (
    <EmptyPreviewSession
      {...props}
      key={replay}
      onReset={() => {
        localStorage.removeItem(STORAGE_KEYS.onboardingCompleted);
        setReplay((value) => value + 1);
      }}
    />
  );
}

function EmptyPreviewSession({
  height,
  interactiveCompletion = false,
  onReset,
  records,
  scale,
  width,
}: {
  height: string;
  interactiveCompletion?: boolean;
  onReset: () => void;
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
      {interactiveCompletion ? (
        <div className="flex gap-2 p-2">
          <Button
            onClick={() =>
              store.dispatch(achievementRecordsUpdated({ records: completeAchievementRecords }))
            }
          >
            Complete final task
          </Button>
          <Button onClick={onReset} variant="outline">
            Reset scenario
          </Button>
        </div>
      ) : null}
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
  args: { height: "100vh", records: almostCompleteGettingStartedRecords, width: "100vw" },
  argTypes: { scale: { control: { type: "select" }, options: [75, 100, 125, 150, 200] } },
};

/** Complete the remaining task, then confirm completion to watch the panel exit; reset to replay. */
export const CompleteFinalTask: Story = {
  args: { interactiveCompletion: true, records: almostCompleteGettingStartedRecords },
};

import "@/i18n/config";

import type { Meta, StoryObj } from "@storybook/react";
import { useEffect, useMemo, useState } from "react";
import { Provider } from "react-redux";

import { Button } from "@/components/ui/button";

import { AppCommandCenter } from "@/app/components/AppCommandCenter";
import { CommandPaletteProvider } from "@/app/providers/CommandPaletteProvider";
import {
  capabilitiesChecking,
  capabilitiesFailed,
  capabilitiesReady,
} from "@/app/store/slices/source-slice";
import { createAppStore } from "@/app/store/store";
import type { MediaCapabilities } from "@/lib/tauri/media.types";

type CommandCenterStoryState = "checking" | "ready" | "partial" | "unavailable" | "failed";

type AppCommandCenterStoryArgs = {
  state: CommandCenterStoryState;
};

const meta = {
  component: AppCommandCenter,
  args: { state: "checking" },
  argTypes: {
    state: {
      control: "select",
      options: ["checking", "ready", "partial", "unavailable", "failed"],
    },
  },
  parameters: { layout: "centered" },
  render: ({ state }) => <AppCommandCenterStory state={state} />,
  tags: ["autodocs"],
  title: "App/Command Center",
} satisfies Meta<AppCommandCenterStoryArgs>;

export default meta;

type Story = StoryObj<typeof meta>;

const readyCapabilities: MediaCapabilities = {
  ffmpeg: {
    available: true,
    path: "C:/Tools/ffmpeg.exe",
    version: "ffmpeg version 7.1",
  },
  ffprobe: {
    available: true,
    path: "C:/Tools/ffprobe.exe",
    version: "ffprobe version 7.1",
  },
};

function AppCommandCenterStory({ state }: AppCommandCenterStoryArgs) {
  const store = useMemo(() => createAppStore(), []);
  const [animationRun, setAnimationRun] = useState(0);

  useEffect(() => {
    switch (state) {
      case "checking":
        store.dispatch(capabilitiesChecking());
        break;
      case "ready":
        store.dispatch(capabilitiesReady(readyCapabilities));
        break;
      case "partial":
        store.dispatch(
          capabilitiesReady({
            ffmpeg: readyCapabilities.ffmpeg,
            ffprobe: { available: false, error: "ffprobe is not available on PATH." },
          }),
        );
        break;
      case "unavailable":
        store.dispatch(
          capabilitiesReady({
            ffmpeg: { available: false, error: "ffmpeg is not available on PATH." },
            ffprobe: { available: false, error: "ffprobe is not available on PATH." },
          }),
        );
        break;
      case "failed":
        store.dispatch(
          capabilitiesFailed({ code: "internal", message: "Capability check failed." }),
        );
        break;
    }
  }, [state, store]);

  return (
    <Provider store={store}>
      <CommandPaletteProvider>
        <div className="grid justify-items-start gap-3">
          <div className="flex h-10 items-center rounded-lg border bg-background px-1">
            <AppCommandCenter key={animationRun} />
          </div>
          <Button onClick={() => setAnimationRun((run) => run + 1)} size="sm" variant="outline">
            Replay startup animation
          </Button>
        </div>
      </CommandPaletteProvider>
    </Provider>
  );
}

export const Playground: Story = {};

export const Checking: Story = {
  args: { state: "checking" },
};

export const Ready: Story = {
  args: { state: "ready" },
};

export const Partial: Story = {
  args: { state: "partial" },
};

export const Unavailable: Story = {
  args: { state: "unavailable" },
};

export const CheckFailed: Story = {
  args: { state: "failed" },
};

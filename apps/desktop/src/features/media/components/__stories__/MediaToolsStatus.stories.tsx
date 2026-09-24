import "@/i18n/config";

import type { Meta, StoryObj } from "@storybook/react";
import { useEffect, useMemo } from "react";
import { Provider } from "react-redux";

import { ButtonGroup } from "@/components/ui/button-group";

import {
  capabilitiesChecking,
  capabilitiesFailed,
  capabilitiesReady,
} from "@/app/store/slices/source-slice";
import { createAppStore } from "@/app/store/store";
import type { MediaCapabilities } from "@/lib/tauri/media.types";

import {
  MediaToolsStatus,
  MediaToolsStatusContent,
  MediaToolsStatusTrigger,
} from "../MediaToolsStatus";

type MediaToolsStoryState = "checking" | "ready" | "partial" | "unavailable" | "failed";

type MediaToolsStatusStoryArgs = {
  presentation: "compact" | "default";
  state: MediaToolsStoryState;
};

const meta = {
  component: MediaToolsStatusStory,
  args: { presentation: "default", state: "ready" },
  argTypes: {
    presentation: {
      control: "select",
      options: ["compact", "default"],
    },
    state: {
      control: "select",
      options: ["checking", "ready", "partial", "unavailable", "failed"],
    },
  },
  parameters: { layout: "centered" },
  render: ({ presentation, state }) => (
    <MediaToolsStatusStory presentation={presentation} state={state} />
  ),
  tags: ["autodocs"],
  title: "Media/Media Tools Status",
} satisfies Meta<MediaToolsStatusStoryArgs>;

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

function MediaToolsStatusStory({ presentation, state }: MediaToolsStatusStoryArgs) {
  const store = useMemo(() => createAppStore(), []);

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
      <MediaToolsStatus>
        <ButtonGroup className="h-10 items-center rounded-lg border bg-background px-1">
          <MediaToolsStatusTrigger presentation={presentation} />
          <MediaToolsStatusContent />
        </ButtonGroup>
      </MediaToolsStatus>
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

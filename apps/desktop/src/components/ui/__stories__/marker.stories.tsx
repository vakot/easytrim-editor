import type { Meta, StoryObj } from "@storybook/react";
import { Check, File, Info, Play, RotateCcw, Square } from "lucide-react";

import { Button } from "../button";
import {
  Marker,
  MarkerAction,
  MarkerContent,
  MarkerDescription,
  MarkerGroup,
  MarkerIcon,
  MarkerTitle,
} from "../marker";

const meta = {
  component: Marker,
  tags: ["autodocs"],
  title: "Design System/Marker",
} satisfies Meta<typeof Marker>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <Marker className="w-72" {...args}>
      <MarkerIcon>
        <Info />
      </MarkerIcon>
      <MarkerContent>Helpful contextual information</MarkerContent>
    </Marker>
  ),
};

export const WithDescription: Story = {
  render: (args) => (
    <Marker className="w-72 items-start" {...args}>
      <MarkerIcon>
        <Info />
      </MarkerIcon>
      <MarkerContent>
        Completed activity
        <MarkerDescription>11:47 AM</MarkerDescription>
      </MarkerContent>
    </Marker>
  ),
};

export const WithAction: Story = {
  render: (args) => (
    <Marker className="w-72" {...args}>
      <MarkerIcon>
        <Info />
      </MarkerIcon>
      <MarkerContent>Completed activity</MarkerContent>
      <MarkerAction>
        <Button size="xs" variant="outline">
          Open
        </Button>
      </MarkerAction>
    </Marker>
  ),
};

export const WithDescriptionAndAction: Story = {
  render: (args) => (
    <Marker className="w-72 items-start" {...args}>
      <MarkerIcon>
        <Info />
      </MarkerIcon>
      <MarkerContent>
        Completed activity
        <MarkerDescription>
          <span className="shrink-0">11:47 AM</span>
          <span aria-hidden="true">В·</span>
          <span
            className="min-w-0 truncate"
            title="C:\\Users\\Editor\\Videos\\Projects\\EasyTrim\\Exports\\completed-video.mp4"
          >
            C:\Users\Editor\Videos\Projects\EasyTrim\Exports\completed-video.mp4
          </span>
        </MarkerDescription>
      </MarkerContent>
      <MarkerAction>
        <Button size="xs" variant="outline">
          Open
        </Button>
      </MarkerAction>
    </Marker>
  ),
};

export const Separator: Story = {
  args: { children: <MarkerContent>Today</MarkerContent>, variant: "separator" },
  render: (args) => <Marker className="w-72" {...args} />,
};

export const Group: Story = {
  render: () => (
    <>
      <Marker className="mb-2 text-foreground">
        <MarkerIcon>
          <File />
        </MarkerIcon>

        <MarkerContent>
          <MarkerTitle>File loaded</MarkerTitle>
          <MarkerDescription>Filename</MarkerDescription>
        </MarkerContent>
      </Marker>
      <MarkerGroup className="w-72 gap-5 pt-1">
        <Marker>
          <MarkerIcon>
            <Play />
          </MarkerIcon>

          <MarkerContent>
            <MarkerTitle>Started rendering</MarkerTitle>
          </MarkerContent>
        </Marker>

        <Marker>
          <MarkerIcon>
            <RotateCcw />
          </MarkerIcon>

          <MarkerContent>
            <MarkerTitle>Rendering…</MarkerTitle>
            <MarkerDescription>Processing video</MarkerDescription>
          </MarkerContent>
        </Marker>

        <Marker>
          <MarkerIcon>
            <Check />
          </MarkerIcon>

          <MarkerContent>
            <MarkerTitle>Render completed</MarkerTitle>
          </MarkerContent>
        </Marker>

        <Marker>
          <MarkerContent>
            <MarkerTitle>File deleted</MarkerTitle>
          </MarkerContent>

          <MarkerAction className="-mt-1">
            <Button disabled size="xs" variant="outline">
              Restore
            </Button>
          </MarkerAction>
        </Marker>

        <Marker>
          <MarkerIcon>
            <Square />
          </MarkerIcon>

          <MarkerContent>
            <MarkerTitle>File restored</MarkerTitle>
          </MarkerContent>

          <MarkerAction className="-mt-1">
            <Button size="xs" variant="outline">
              Delete
            </Button>
          </MarkerAction>
        </Marker>
      </MarkerGroup>
    </>
  ),
};

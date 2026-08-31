import type { Meta, StoryObj } from "@storybook/react";
import { Info } from "lucide-react";

import { Button } from "../button";
import { Marker, MarkerAction, MarkerContent, MarkerDescription, MarkerIcon } from "../marker";

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

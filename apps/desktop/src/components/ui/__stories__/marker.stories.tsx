import type { Meta, StoryObj } from "@storybook/react";
import { CircleCheck, Info } from "lucide-react";

import { Marker, MarkerContent, MarkerIcon } from "../marker";

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

export const Border: Story = {
  args: { variant: "border" },
  render: (args) => (
    <Marker className="w-72" {...args}>
      <MarkerIcon>
        <CircleCheck />
      </MarkerIcon>
      <MarkerContent>Completed activity</MarkerContent>
    </Marker>
  ),
};

export const Separator: Story = {
  args: { children: <MarkerContent>Today</MarkerContent>, variant: "separator" },
  render: (args) => <Marker className="w-72" {...args} />,
};

import type { Meta, StoryObj } from "@storybook/react";

import { Highlight } from "../highlight";

const meta = {
  args: {
    children: "C:/Media/Project/clip-clip.mp4",
    query: "clip",
  },
  component: Highlight,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  title: "Design System/Highlight",
} satisfies Meta<typeof Highlight>;

export default meta;

type Story = StoryObj<typeof meta>;

export const MultipleMatches: Story = {};

export const CaseInsensitive: Story = {
  args: { query: "PROJECT" },
};

export const NoMatch: Story = {
  args: { query: "missing" },
};

export const EmptyQuery: Story = {
  args: { query: "" },
};

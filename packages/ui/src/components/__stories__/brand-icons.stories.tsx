import type { Meta, StoryObj } from "@storybook/react";

import { GithubIcon, KofiIcon } from "../brand-icons";

const meta = {
  component: GithubIcon,
  tags: ["autodocs"],
  title: "Design System/Brand Icons",
} satisfies Meta<typeof GithubIcon>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <GithubIcon aria-label="GitHub" className="size-6" />
      <KofiIcon aria-label="Ko-fi" className="size-6" />
    </div>
  ),
};

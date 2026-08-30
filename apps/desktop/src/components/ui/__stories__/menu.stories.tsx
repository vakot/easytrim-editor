import type { Meta, StoryObj } from "@storybook/react";
import { CheckIcon, SettingsIcon } from "lucide-react";

import { MenuIcon } from "../menu";

const meta = {
  component: MenuIcon,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  title: "Design System/Menu",
} satisfies Meta<typeof MenuIcon>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div className="grid gap-2 rounded-lg border bg-popover p-1 text-popover-foreground">
      <div className="relative flex h-6 min-w-36 items-center gap-8 rounded-md px-1.5 py-1 text-xs">
        <MenuIcon>
          <SettingsIcon />
        </MenuIcon>
        Settings
      </div>
      <div className="relative flex h-6 min-w-36 items-center gap-8 rounded-md px-1.5 py-1 text-xs">
        <MenuIcon>
          <CheckIcon />
        </MenuIcon>
        Selected item
      </div>
    </div>
  ),
};

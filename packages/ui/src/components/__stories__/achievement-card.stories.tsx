import type { Meta, StoryObj } from "@storybook/react";
import { Crop, Crown, LockKeyhole } from "lucide-react";

import { AchievementCard } from "../achievement-card";
import { Progress } from "../progress";

const meta = {
  args: {
    description: "Crop the frame to a new size",
    icon: Crop,
    status: "Unlocked",
    title: "Frame by Frame",
    unlocked: true,
  },
  component: AchievementCard,
  decorators: [
    (Story) => (
      <div className="max-w-sm" role="list">
        <Story />
      </div>
    ),
  ],
  tags: ["autodocs"],
  title: "Design System/Achievement Card",
} satisfies Meta<typeof AchievementCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Unlocked: Story = {
  args: { children: <p className="text-xs text-muted-foreground">Unlocked on May 4, 2026</p> },
};

export const New: Story = { args: { newLabel: "New" } };

/** Progress is a detail the caller provides below the description. */
export const LockedWithProgress: Story = {
  args: {
    children: <Progress aria-label="Frame by Frame progress" className="mt-1" value={40} />,
    status: "Locked",
    unlocked: false,
  },
};

export const SecretUnlocked: Story = {
  args: {
    description: "Encounter every legendary splash message",
    icon: Crown,
    secret: true,
    title: "The Chosen One",
  },
};

/** The caller conceals a locked secret's name, description, and icon. */
export const SecretLocked: Story = {
  args: {
    description: "A secret achievement. Keep exploring to reveal it",
    icon: LockKeyhole,
    secret: true,
    status: "Locked",
    title: "???",
    unlocked: false,
  },
};

export const Compact: Story = { args: { compact: true } };

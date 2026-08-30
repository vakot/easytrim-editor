import type { Meta, StoryObj } from "@storybook/react";

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../card";

const meta = {
  component: Card,
  tags: ["autodocs"],
  title: "Design System/Card",
} satisfies Meta<typeof Card>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Card className="w-80">
      <CardHeader>
        <CardTitle>Project export</CardTitle>
        <CardDescription>Choose where to save your trimmed video.</CardDescription>
        <CardAction>MP4</CardAction>
      </CardHeader>
      <CardContent className="text-muted-foreground">1080p · H.264 · 24 fps</CardContent>
      <CardFooter>Ready to export</CardFooter>
    </Card>
  ),
};

export const Small: Story = {
  render: () => (
    <Card className="w-64" size="sm">
      <CardHeader>
        <CardTitle>Compact card</CardTitle>
      </CardHeader>
      <CardContent>Content with the small spacing scale.</CardContent>
    </Card>
  ),
};

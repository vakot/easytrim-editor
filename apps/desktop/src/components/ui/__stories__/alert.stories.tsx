import type { Meta, StoryObj } from "@storybook/react";
import { InfoIcon, TriangleAlertIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "../alert";

const meta = {
  component: Alert,
  tags: ["autodocs"],
  title: "Design System/Alert",
} satisfies Meta<typeof Alert>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Alert>
      <InfoIcon />
      <AlertTitle>Project ready</AlertTitle>
      <AlertDescription>Your media is ready to export.</AlertDescription>
    </Alert>
  ),
};

export const Destructive: Story = {
  render: () => (
    <Alert variant="destructive">
      <TriangleAlertIcon />
      <AlertTitle>Export failed</AlertTitle>
      <AlertDescription>Check the output location and try again.</AlertDescription>
    </Alert>
  ),
};

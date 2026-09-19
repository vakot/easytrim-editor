import type { Meta, StoryObj } from "@storybook/react";

import { Button } from "../button";
import { Textarea, TextareaHeader, TextareaInput } from "../textarea";

const meta = {
  component: Textarea,
  tags: ["autodocs"],
  title: "Design System/Textarea",
} satisfies Meta<typeof Textarea>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Textarea className="w-96">
      <TextareaHeader>
        <span className="text-sm font-medium">Notes</span>
        <Button size="sm" type="button" variant="ghost">
          Save
        </Button>
      </TextareaHeader>
      <TextareaInput placeholder="Add notes about this edit" />
    </Textarea>
  ),
};

export const Invalid: Story = {
  render: () => (
    <Textarea className="w-96">
      <TextareaHeader>
        <span className="text-sm font-medium">Notes</span>
      </TextareaHeader>
      <TextareaInput aria-invalid defaultValue="This value needs attention." />
    </Textarea>
  ),
};

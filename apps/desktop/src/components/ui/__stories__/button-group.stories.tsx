import type { Meta, StoryObj } from "@storybook/react";

import { Button } from "../button";
import { ButtonGroup, ButtonGroupSeparator, ButtonGroupText } from "../button-group";

const meta = {
  component: ButtonGroup,
  tags: ["autodocs"],
  title: "Design System/Button Group",
} satisfies Meta<typeof ButtonGroup>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <ButtonGroup>
      <Button variant="outline">Previous</Button>
      <Button variant="outline">Next</Button>
    </ButtonGroup>
  ),
};

export const WithTextAndSeparator: Story = {
  render: () => (
    <ButtonGroup>
      <ButtonGroupText>Playback</ButtonGroupText>
      <ButtonGroupSeparator />
      <Button variant="outline">Play</Button>
      <Button variant="outline">Pause</Button>
    </ButtonGroup>
  ),
};

export const Vertical: Story = {
  render: () => (
    <ButtonGroup orientation="vertical">
      <Button variant="outline">Top</Button>
      <Button variant="outline">Middle</Button>
      <Button variant="outline">Bottom</Button>
    </ButtonGroup>
  ),
};

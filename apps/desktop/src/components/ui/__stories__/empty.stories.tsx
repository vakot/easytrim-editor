import type { Meta, StoryObj } from "@storybook/react";
import { FolderCode, MoveUpRight } from "lucide-react";

import { Button } from "../button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "../empty";

const meta = {
  component: Empty,
  tags: ["autodocs"],
  title: "Design System/Empty",
} satisfies Meta<typeof Empty>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FolderCode />
        </EmptyMedia>
        <EmptyTitle>No Projects Yet</EmptyTitle>
        <EmptyDescription>
          You haven&apos;t created any projects yet. Get started by creating your first project.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="flex-row justify-center gap-2">
        <Button>Create Project</Button>
        <Button variant="outline">Import Project</Button>
      </EmptyContent>
      <Button asChild className="text-muted-foreground" size="sm" variant="link">
        <a href="#">
          Learn More <MoveUpRight />
        </a>
      </Button>
    </Empty>
  ),
};

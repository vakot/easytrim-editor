import type { Meta, StoryObj } from "@storybook/react";
import { CheckIcon, ChevronRightIcon, SettingsIcon } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "../dropdown-menu";

const meta = {
  component: DropdownMenu,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  title: "Design System/Dropdown Menu",
} satisfies Meta<typeof DropdownMenu>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <DropdownMenu defaultOpen>
      <DropdownMenuTrigger className="rounded-md border px-3 py-2 text-sm">
        Open menu
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>Project</DropdownMenuLabel>
        <DropdownMenuItem>
          <SettingsIcon />
          Settings
          <DropdownMenuShortcut>⌘,</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem checked keepOpen>
          Keep menu open
        </DropdownMenuCheckboxItem>
        <DropdownMenuRadioGroup value="balanced">
          <DropdownMenuRadioItem value="fast">Fast export</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="balanced">Balanced export</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            More options
            <ChevronRightIcon />
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem>
              <CheckIcon />
              Include audio
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};

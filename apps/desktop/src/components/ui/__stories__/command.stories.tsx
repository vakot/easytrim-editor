import type { Meta, StoryObj } from "@storybook/react";
import { FileInputIcon, FolderOpenIcon } from "lucide-react";

import { Kbd, KbdGroup } from "@/components/ui/kbd";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "../command";

const meta = {
  component: Command,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  title: "Design System/Command",
} satisfies Meta<typeof Command>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Command className="w-96 border" label="Search commands">
      <CommandInput placeholder="Search commands…" />
      <CommandList>
        <CommandEmpty>No commands found.</CommandEmpty>
        <CommandGroup heading="File">
          <CommandItem>
            <FileInputIcon />
            Open File
            <CommandShortcut>
              <KbdGroup>
                <Kbd>Ctrl</Kbd>
                <Kbd>O</Kbd>
              </KbdGroup>
            </CommandShortcut>
          </CommandItem>
          <CommandItem>
            <FolderOpenIcon />
            Open Folder
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  ),
};

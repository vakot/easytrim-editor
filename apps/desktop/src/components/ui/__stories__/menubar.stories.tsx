import type { Meta, StoryObj } from "@storybook/react";
import { FileIcon, SettingsIcon } from "lucide-react";

import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarTrigger,
} from "../menubar";

const meta = {
  component: Menubar,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  title: "Design System/Menubar",
} satisfies Meta<typeof Menubar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Menubar>
      <MenubarMenu>
        <MenubarTrigger>File</MenubarTrigger>
        <MenubarContent>
          <MenubarItem>
            <FileIcon />
            New project
          </MenubarItem>
          <MenubarSeparator />
          <MenubarSub>
            <MenubarSubTrigger>
              <SettingsIcon />
              Export settings
            </MenubarSubTrigger>
            <MenubarSubContent>
              <MenubarItem>MP4</MenubarItem>
              <MenubarItem>WebM</MenubarItem>
            </MenubarSubContent>
          </MenubarSub>
        </MenubarContent>
      </MenubarMenu>
      <MenubarMenu>
        <MenubarTrigger>View</MenubarTrigger>
        <MenubarContent>
          <MenubarItem keepOpen>Show timeline</MenubarItem>
        </MenubarContent>
      </MenubarMenu>
    </Menubar>
  ),
};

import type { Meta, StoryObj } from "@storybook/react";
import { FileIcon } from "lucide-react";
import { useState } from "react";

import { Kbd, KbdGroup } from "@/components/ui/kbd";

import {
  Menubar,
  MenubarCheckboxItem,
  MenubarContent,
  MenubarIcon,
  MenubarItem,
  MenubarLabel,
  MenubarMenu,
  MenubarRadioGroup,
  MenubarRadioItem,
  MenubarSeparator,
  MenubarShortcut,
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
      <DefaultMenu />
      <InsetMenu />
      <RadioMenu />
      <CheckboxMenu />
    </Menubar>
  ),
};

function DefaultMenu() {
  return (
    <MenubarMenu>
      <MenubarTrigger>Default</MenubarTrigger>
      <MenubarContent>
        <MenubarItem>
          Open
          <MenubarShortcut>
            <KbdGroup>
              <Kbd>⌘</Kbd>
              <Kbd>O</Kbd>
            </KbdGroup>
          </MenubarShortcut>
        </MenubarItem>
        <MenubarItem>Close</MenubarItem>

        <MenubarSeparator />

        <MenubarItem>
          <MenubarIcon side="right">
            <FileIcon />
          </MenubarIcon>
          Icon right
        </MenubarItem>

        <MenubarSeparator />

        <MenubarSub>
          <MenubarSubTrigger>Submenu</MenubarSubTrigger>
          <MenubarSubContent>
            <MenubarItem keepOpen>Sub - 1</MenubarItem>
            <MenubarItem keepOpen>Sub - 2</MenubarItem>
            <MenubarItem disabled keepOpen>
              Sub - 3
            </MenubarItem>
          </MenubarSubContent>
        </MenubarSub>

        <MenubarSeparator />

        <MenubarItem disabled>Disabled</MenubarItem>
        <MenubarItem variant="destructive">Destructive</MenubarItem>
        <MenubarItem variant="success">Success</MenubarItem>
      </MenubarContent>
    </MenubarMenu>
  );
}

function InsetMenu() {
  return (
    <MenubarMenu>
      <MenubarTrigger>Inset</MenubarTrigger>
      <MenubarContent>
        <MenubarLabel>Simple</MenubarLabel>
        <MenubarItem inset>
          Open
          <MenubarShortcut>
            <KbdGroup>
              <Kbd>⌘</Kbd>
              <Kbd>O</Kbd>
            </KbdGroup>
          </MenubarShortcut>
        </MenubarItem>
        <MenubarItem inset>Close</MenubarItem>

        <MenubarSeparator />

        <MenubarLabel>Icon</MenubarLabel>
        <MenubarItem inset>
          <MenubarIcon>
            <FileIcon />
          </MenubarIcon>
          Icon left
        </MenubarItem>
        <MenubarItem inset>
          <MenubarIcon side="right">
            <FileIcon />
          </MenubarIcon>
          Icon right
        </MenubarItem>
        <MenubarItem inset>
          <MenubarIcon>
            <FileIcon />
          </MenubarIcon>
          Icon both
          <MenubarIcon side="right">
            <FileIcon />
          </MenubarIcon>
        </MenubarItem>

        <MenubarSeparator />

        <MenubarLabel>Submenu</MenubarLabel>
        <MenubarSub>
          <MenubarSubTrigger inset>Submenu</MenubarSubTrigger>
          <MenubarSubContent>
            <MenubarItem keepOpen>Sub - 1</MenubarItem>
            <MenubarItem keepOpen>Sub - 2</MenubarItem>
            <MenubarItem disabled keepOpen>
              Sub - 3
            </MenubarItem>
          </MenubarSubContent>
        </MenubarSub>

        <MenubarSeparator />

        <MenubarLabel>Variants</MenubarLabel>
        <MenubarItem disabled inset>
          Disabled
        </MenubarItem>
        <MenubarItem inset variant="destructive">
          Destructive
        </MenubarItem>
        <MenubarItem inset variant="success">
          Success
        </MenubarItem>
      </MenubarContent>
    </MenubarMenu>
  );
}

function RadioMenu() {
  const [value, setValue] = useState<string>("1");

  return (
    <MenubarMenu>
      <MenubarTrigger>Radio</MenubarTrigger>
      <MenubarContent>
        <MenubarRadioGroup onValueChange={setValue} value={value}>
          <MenubarRadioItem keepOpen value="1">
            Default
          </MenubarRadioItem>
          <MenubarRadioItem inset keepOpen value="3">
            Inset
          </MenubarRadioItem>
          <MenubarRadioItem inset keepOpen value="4">
            Icon right
            <MenubarIcon side="right">
              <FileIcon />
            </MenubarIcon>
          </MenubarRadioItem>
        </MenubarRadioGroup>
      </MenubarContent>
    </MenubarMenu>
  );
}

function CheckboxMenu() {
  const [checked1, setChecked1] = useState<boolean>(true);
  const [checked2, setChecked2] = useState<boolean>(false);
  const [checked3, setChecked3] = useState<boolean>(false);

  return (
    <MenubarMenu>
      <MenubarTrigger>Checkbox</MenubarTrigger>
      <MenubarContent>
        <MenubarCheckboxItem checked={checked1} keepOpen onCheckedChange={setChecked1}>
          Default
        </MenubarCheckboxItem>
        <MenubarCheckboxItem checked={checked2} inset keepOpen onCheckedChange={setChecked2}>
          Inset
        </MenubarCheckboxItem>
        <MenubarCheckboxItem checked={checked3} inset keepOpen onCheckedChange={setChecked3}>
          Icon right
          <MenubarIcon side="right">
            <FileIcon />
          </MenubarIcon>
        </MenubarCheckboxItem>
      </MenubarContent>
    </MenubarMenu>
  );
}

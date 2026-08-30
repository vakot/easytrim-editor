import type { Meta, StoryObj } from "@storybook/react";
import { FileIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Kbd, KbdGroup } from "@/components/ui/kbd";

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuIcon,
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
    <DropdownMenu>
      <DefaultMenu />
      <InsetMenu />
      <RadioMenu />
      <CheckboxMenu />
    </DropdownMenu>
  ),
};

function DefaultMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="xs" variant="ghost">
          Default
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem>
          Open
          <DropdownMenuShortcut>
            <KbdGroup>
              <Kbd>⌘</Kbd>
              <Kbd>O</Kbd>
            </KbdGroup>
          </DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem>Close</DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem>
          <DropdownMenuIcon side="right">
            <FileIcon />
          </DropdownMenuIcon>
          Icon right
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Submenu</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem keepOpen>Sub - 1</DropdownMenuItem>
            <DropdownMenuItem keepOpen>Sub - 2</DropdownMenuItem>
            <DropdownMenuItem disabled keepOpen>
              Sub - 3
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator />

        <DropdownMenuItem disabled>Disabled</DropdownMenuItem>
        <DropdownMenuItem variant="destructive">Destructive</DropdownMenuItem>
        <DropdownMenuItem variant="success">Success</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function InsetMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="xs" variant="ghost">
          Inset
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>Simple</DropdownMenuLabel>
        <DropdownMenuItem inset>
          Open
          <DropdownMenuShortcut>
            <KbdGroup>
              <Kbd>⌘</Kbd>
              <Kbd>O</Kbd>
            </KbdGroup>
          </DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem inset>Close</DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuLabel>Icon</DropdownMenuLabel>
        <DropdownMenuItem inset>
          <DropdownMenuIcon>
            <FileIcon />
          </DropdownMenuIcon>
          Icon left
        </DropdownMenuItem>
        <DropdownMenuItem inset>
          <DropdownMenuIcon side="right">
            <FileIcon />
          </DropdownMenuIcon>
          Icon right
        </DropdownMenuItem>
        <DropdownMenuItem inset>
          <DropdownMenuIcon>
            <FileIcon />
          </DropdownMenuIcon>
          Icon both
          <DropdownMenuIcon side="right">
            <FileIcon />
          </DropdownMenuIcon>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuLabel>Submenu</DropdownMenuLabel>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger inset>Submenu</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem keepOpen>Sub - 1</DropdownMenuItem>
            <DropdownMenuItem keepOpen>Sub - 2</DropdownMenuItem>
            <DropdownMenuItem disabled keepOpen>
              Sub - 3
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator />

        <DropdownMenuLabel>Variants</DropdownMenuLabel>
        <DropdownMenuItem disabled inset>
          Disabled
        </DropdownMenuItem>
        <DropdownMenuItem inset variant="destructive">
          Destructive
        </DropdownMenuItem>
        <DropdownMenuItem inset variant="success">
          Success
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function RadioMenu() {
  const [value, setValue] = useState<string>("1");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="xs" variant="ghost">
          Radio
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuRadioGroup onValueChange={setValue} value={value}>
          <DropdownMenuRadioItem keepOpen value="1">
            Default
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem inset keepOpen value="3">
            Inset
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem inset keepOpen value="4">
            Icon right
            <DropdownMenuIcon side="right">
              <FileIcon />
            </DropdownMenuIcon>
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function CheckboxMenu() {
  const [checked1, setChecked1] = useState<boolean>(true);
  const [checked2, setChecked2] = useState<boolean>(false);
  const [checked3, setChecked3] = useState<boolean>(false);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="xs" variant="ghost">
          Checkbox
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuCheckboxItem checked={checked1} keepOpen onCheckedChange={setChecked1}>
          Default
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem checked={checked2} inset keepOpen onCheckedChange={setChecked2}>
          Inset
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem checked={checked3} inset keepOpen onCheckedChange={setChecked3}>
          Icon right
          <DropdownMenuIcon side="right">
            <FileIcon />
          </DropdownMenuIcon>
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

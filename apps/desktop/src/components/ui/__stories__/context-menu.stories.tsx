import type { Meta, StoryObj } from "@storybook/react";
import { FileIcon } from "lucide-react";
import { useState } from "react";

import { Kbd, KbdGroup } from "@/components/ui/kbd";

import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuIcon,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "../context-menu";

const meta = {
  component: ContextMenu,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  title: "Design System/Context Menu",
} satisfies Meta<typeof ContextMenu>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <DefaultContextMenu />,
};

export const Variants: Story = {
  render: () => <VariantContextMenu />,
};

function ContextMenuTarget({ children }: { children: string }) {
  return (
    <ContextMenuTrigger asChild>
      <div className="flex h-40 w-72 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
        {children}
      </div>
    </ContextMenuTrigger>
  );
}

function DefaultContextMenu() {
  return (
    <ContextMenu>
      <ContextMenuTarget>Right-click anywhere in this area</ContextMenuTarget>
      <ContextMenuContent>
        <ContextMenuItem>
          Open
          <ContextMenuShortcut>
            <KbdGroup>
              <Kbd>Ctrl</Kbd>
              <Kbd>O</Kbd>
            </KbdGroup>
          </ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem>Close</ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuItem inset>
          <ContextMenuIcon>
            <FileIcon />
          </ContextMenuIcon>
          Icon
        </ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuSub>
          <ContextMenuSubTrigger>Submenu</ContextMenuSubTrigger>
          <ContextMenuSubContent>
            <ContextMenuItem>Sub - 1</ContextMenuItem>
            <ContextMenuItem>Sub - 2</ContextMenuItem>
            <ContextMenuItem disabled>Sub - 3</ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
      </ContextMenuContent>
    </ContextMenu>
  );
}

function VariantContextMenu() {
  const [checked, setChecked] = useState(true);
  const [value, setValue] = useState("default");

  return (
    <ContextMenu>
      <ContextMenuTarget>Right-click to inspect the variants</ContextMenuTarget>
      <ContextMenuContent>
        <ContextMenuLabel>Items</ContextMenuLabel>
        <ContextMenuItem>Default</ContextMenuItem>
        <ContextMenuItem inset>Inset</ContextMenuItem>
        <ContextMenuItem disabled>Disabled</ContextMenuItem>
        <ContextMenuItem variant="destructive">Destructive</ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuLabel>Selection</ContextMenuLabel>
        <ContextMenuCheckboxItem checked={checked} onCheckedChange={setChecked}>
          Checked
        </ContextMenuCheckboxItem>
        <ContextMenuRadioGroup onValueChange={setValue} value={value}>
          <ContextMenuRadioItem value="default">Radio default</ContextMenuRadioItem>
          <ContextMenuRadioItem inset value="inset">
            Radio inset
          </ContextMenuRadioItem>
        </ContextMenuRadioGroup>
      </ContextMenuContent>
    </ContextMenu>
  );
}

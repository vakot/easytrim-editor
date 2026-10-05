import type { Meta, StoryObj } from "@storybook/react";
import { CheckIcon, ChevronsUpDownIcon } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxSeparator,
  ComboboxTrigger,
} from "@/components/ui/combobox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { cn } from "@/lib/class-names.utils";

const frameworks = [
  {
    value: "next.js",
    label: "Next.js",
  },
  {
    value: "sveltekit",
    label: "SvelteKit",
  },
  {
    value: "nuxt.js",
    label: "Nuxt.js",
  },
  {
    value: "remix",
    label: "Remix",
  },
  {
    value: "astro",
    label: "Astro",
  },
];

const meta = {
  title: "Design System/Combobox",
  component: Combobox,
  parameters: {
    layout: "centered",
  },
} satisfies Meta<typeof Combobox>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ButtonTrigger: Story = {
  render: () => <ButtonTriggerStory />,
};

function ButtonTriggerStory() {
  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState("");

  const selected = frameworks.find((framework) => framework.value === value);

  return (
    <Combobox onOpenChange={setOpen} open={open}>
      <ComboboxTrigger>
        <Button
          aria-expanded={open}
          className="w-52 justify-between"
          role="combobox"
          variant="outline"
        >
          {selected?.label ?? "Select framework..."}

          <ChevronsUpDownIcon className="opacity-50" />
        </Button>
      </ComboboxTrigger>

      <ComboboxContent>
        <ComboboxInput placeholder="Search framework..." />

        <ComboboxList>
          <ComboboxEmpty>No framework found.</ComboboxEmpty>

          <ComboboxGroup>
            {frameworks.map((framework) => (
              <ComboboxItem
                key={framework.value}
                onSelect={(currentValue) => {
                  setValue(currentValue === value ? "" : currentValue);
                  setOpen(false);
                }}
                value={framework.value}
              >
                {framework.label}

                <CheckIcon
                  className={cn("ml-auto", value === framework.value ? "opacity-100" : "opacity-0")}
                />
              </ComboboxItem>
            ))}
          </ComboboxGroup>
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

export const InputTrigger: Story = {
  render: () => <InputTriggerStory />,
};

function InputTriggerStory() {
  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState("");

  return (
    <Combobox onOpenChange={setOpen} open={open}>
      <ComboboxInput
        className="w-64"
        onValueChange={setValue}
        placeholder="Search framework..."
        value={value}
      />

      <ComboboxContent>
        <ComboboxList>
          <ComboboxEmpty>No framework found.</ComboboxEmpty>

          <ComboboxGroup>
            {frameworks.map((framework) => (
              <ComboboxItem
                key={framework.value}
                onSelect={() => {
                  setValue(framework.label);
                  setOpen(false);
                }}
                value={framework.value}
              >
                {framework.label}
              </ComboboxItem>
            ))}
          </ComboboxGroup>
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

export const InputTriggerWithGroups: Story = {
  render: () => <InputTriggerWithGroupsStory />,
};

function InputTriggerWithGroupsStory() {
  const [value, setValue] = React.useState("");

  return (
    <Combobox>
      <ComboboxInput
        className="w-64"
        onValueChange={setValue}
        placeholder="Search codec..."
        value={value}
      />

      <ComboboxContent>
        <ComboboxList>
          <ComboboxEmpty>No codec found.</ComboboxEmpty>

          <ComboboxGroup heading="Video">
            <ComboboxItem onSelect={setValue} value="H.264">
              H.264
            </ComboboxItem>

            <ComboboxItem onSelect={setValue} value="H.265">
              H.265
            </ComboboxItem>

            <ComboboxItem onSelect={setValue} value="AV1">
              AV1
            </ComboboxItem>
          </ComboboxGroup>

          <ComboboxSeparator />

          <ComboboxGroup heading="Audio">
            <ComboboxItem onSelect={setValue} value="AAC">
              AAC
            </ComboboxItem>

            <ComboboxItem onSelect={setValue} value="Opus">
              Opus
            </ComboboxItem>
          </ComboboxGroup>
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

export const MenuItemTrigger: Story = {
  render: () => <MenuItemTriggerStory />,
};

function MenuItemTriggerStory() {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [value, setValue] = React.useState("next.js");

  const selected = frameworks.find((framework) => framework.value === value);

  return (
    <DropdownMenu onOpenChange={setMenuOpen} open={menuOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">Open menu</Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-56">
        <DropdownMenuItem>Open</DropdownMenuItem>

        <DropdownMenuItem>Duplicate</DropdownMenuItem>

        <DropdownMenuSeparator />

        <Combobox>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              Framework
              <DropdownMenuShortcut>{selected?.label}</DropdownMenuShortcut>
            </DropdownMenuSubTrigger>

            <ComboboxContent asChild>
              <DropdownMenuSubContent className="w-52 p-0">
                <ComboboxInput placeholder="Search framework..." />

                <ComboboxList>
                  <ComboboxEmpty>No framework found.</ComboboxEmpty>

                  <ComboboxGroup>
                    {frameworks.map((framework) => (
                      <ComboboxItem
                        key={framework.value}
                        onSelect={() => {
                          setValue(framework.value);
                          setMenuOpen(false);
                        }}
                        value={framework.value}
                      >
                        {framework.label}

                        <CheckIcon
                          className={cn(
                            "ml-auto",
                            framework.value === value ? "opacity-100" : "opacity-0",
                          )}
                        />
                      </ComboboxItem>
                    ))}
                  </ComboboxGroup>
                </ComboboxList>
              </DropdownMenuSubContent>
            </ComboboxContent>
          </DropdownMenuSub>
        </Combobox>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export const WithoutSearch: Story = {
  render: () => <WithoutSearchStory />,
};

function WithoutSearchStory() {
  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState("");

  const selected = frameworks.find((framework) => framework.value === value);

  return (
    <Combobox onOpenChange={setOpen} open={open}>
      <ComboboxTrigger>
        <Button className="w-52 justify-between" variant="outline">
          {selected?.label ?? "Select framework..."}

          <ChevronsUpDownIcon className="opacity-50" />
        </Button>
      </ComboboxTrigger>

      <ComboboxContent>
        <ComboboxGroup>
          <ComboboxList>
            {frameworks.map((framework) => (
              <ComboboxItem
                key={framework.value}
                onSelect={() => {
                  setValue(framework.value);
                  setOpen(false);
                }}
                value={framework.value}
              >
                {framework.label}
              </ComboboxItem>
            ))}
          </ComboboxList>
        </ComboboxGroup>
      </ComboboxContent>
    </Combobox>
  );
}

export const Groups: Story = {
  render: () => (
    <Combobox>
      <ComboboxTrigger>
        <Button className="w-52 justify-between" variant="outline">
          Select codec...
          <ChevronsUpDownIcon className="opacity-50" />
        </Button>
      </ComboboxTrigger>

      <ComboboxContent>
        <ComboboxInput placeholder="Search codec..." />

        <ComboboxList>
          <ComboboxEmpty>No codec found.</ComboboxEmpty>

          <ComboboxGroup heading="Video">
            <ComboboxItem value="h264">H.264</ComboboxItem>
            <ComboboxItem value="h265">H.265</ComboboxItem>
            <ComboboxItem value="av1">AV1</ComboboxItem>
          </ComboboxGroup>

          <ComboboxSeparator />

          <ComboboxGroup heading="Audio">
            <ComboboxItem value="aac">AAC</ComboboxItem>
            <ComboboxItem value="opus">Opus</ComboboxItem>
          </ComboboxGroup>
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  ),
};

export const DisabledItems: Story = {
  render: () => (
    <Combobox>
      <ComboboxTrigger>
        <Button className="w-52 justify-between" variant="outline">
          Select framework...
          <ChevronsUpDownIcon className="opacity-50" />
        </Button>
      </ComboboxTrigger>

      <ComboboxContent>
        <ComboboxInput placeholder="Search framework..." />

        <ComboboxList>
          <ComboboxEmpty>No framework found.</ComboboxEmpty>

          <ComboboxGroup>
            <ComboboxItem value="next.js">Next.js</ComboboxItem>

            <ComboboxItem value="sveltekit">SvelteKit</ComboboxItem>

            <ComboboxItem disabled value="nuxt.js">
              Nuxt.js
            </ComboboxItem>

            <ComboboxItem value="remix">Remix</ComboboxItem>

            <ComboboxItem disabled value="astro">
              Astro
            </ComboboxItem>
          </ComboboxGroup>
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  ),
};

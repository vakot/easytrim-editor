import type { Meta, StoryObj } from "@storybook/react";
import { within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChevronsUpDownIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  LanguageSelector,
  LanguageSelectorContent,
  LanguageSelectorEmpty,
  LanguageSelectorInput,
  LanguageSelectorList,
  LanguageSelectorOptions,
  LanguageSelectorTrigger,
  LanguageSelectorValue,
} from "@/components/language-selector";
import { SUPPORTED_LANGUAGES } from "@/domain/languages";

const meta = {
  title: "Design System/LanguageSelector",
  component: LanguageSelector,
  args: { label: "Search languages", languages: SUPPORTED_LANGUAGES },
  parameters: {
    layout: "centered",
  },
} satisfies Meta<typeof LanguageSelector>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ButtonTrigger: Story = {
  render: () => <ButtonTriggerExample />,
};

function ButtonTriggerExample({ defaultOpen = false }: { defaultOpen?: boolean }) {
  return (
    <LanguageSelector
      defaultOpen={defaultOpen}
      defaultValue="ru"
      label="Search languages"
      languages={SUPPORTED_LANGUAGES}
    >
      <LanguageSelectorTrigger>
        <Button
          aria-label="Choose language"
          className="w-56 justify-between"
          role="combobox"
          variant="outline"
        >
          <span className="truncate">
            <LanguageSelectorValue placeholder="Select language..." />
          </span>
          <ChevronsUpDownIcon className="shrink-0 text-muted-foreground" />
        </Button>
      </LanguageSelectorTrigger>

      <LanguageSelectorContent>
        <LanguageSelectorInput aria-label="Search languages" placeholder="Search languages…" />
        <LanguageSelectorList>
          <LanguageSelectorEmpty>No languages found</LanguageSelectorEmpty>
          <LanguageSelectorOptions />
        </LanguageSelectorList>
      </LanguageSelectorContent>
    </LanguageSelector>
  );
}

export const InputTrigger: Story = {
  render: () => (
    <LanguageSelector defaultValue="ru" label="Search languages" languages={SUPPORTED_LANGUAGES}>
      <LanguageSelectorInput
        aria-label="Choose language"
        className="w-72"
        placeholder="Search languages…"
      />
      <LanguageSelectorContent>
        <LanguageSelectorList>
          <LanguageSelectorEmpty>No languages found</LanguageSelectorEmpty>
          <LanguageSelectorOptions />
        </LanguageSelectorList>
      </LanguageSelectorContent>
    </LanguageSelector>
  ),
};

export const DropdownMenuSubmenu: Story = {
  render: () => <DropdownMenuSubmenuExample />,
};

function DropdownMenuSubmenuExample() {
  const [languageCode, setLanguageCode] = useState<string>("en");

  const [submenuOpen, setSubmenuOpen] = useState(false);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">Open menu</Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-56">
        <DropdownMenuItem>Open</DropdownMenuItem>
        <DropdownMenuItem>Duplicate</DropdownMenuItem>
        <DropdownMenuSeparator />

        <LanguageSelector
          label="Search languages"
          languages={SUPPORTED_LANGUAGES}
          onValueChange={(code) => {
            setLanguageCode(code ?? "");
            setSubmenuOpen(false);
          }}
          value={languageCode}
        >
          <DropdownMenuSub onOpenChange={setSubmenuOpen} open={submenuOpen}>
            <DropdownMenuSubTrigger>
              Language
              <span className="ml-auto max-w-32 truncate text-muted-foreground">
                <LanguageSelectorValue type="code" />
              </span>
            </DropdownMenuSubTrigger>

            <LanguageSelectorContent asChild>
              <DropdownMenuSubContent>
                <LanguageSelectorInput
                  aria-label="Search languages"
                  className="h-7"
                  placeholder="Search languages…"
                />
                <LanguageSelectorList>
                  <LanguageSelectorEmpty>No languages found</LanguageSelectorEmpty>
                  <LanguageSelectorOptions />
                </LanguageSelectorList>
              </DropdownMenuSubContent>
            </LanguageSelectorContent>
          </DropdownMenuSub>
        </LanguageSelector>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NoResultsExample() {
  return (
    <LanguageSelector defaultOpen label="Search languages" languages={SUPPORTED_LANGUAGES}>
      <LanguageSelectorTrigger>
        <Button
          aria-label="Choose language"
          className="w-56 justify-between"
          role="combobox"
          variant="outline"
        >
          <LanguageSelectorValue placeholder="Select language..." />
          <ChevronsUpDownIcon className="text-muted-foreground" />
        </Button>
      </LanguageSelectorTrigger>

      <LanguageSelectorContent>
        <LanguageSelectorInput aria-label="Search languages" placeholder="Search languages…" />
        <LanguageSelectorList>
          <LanguageSelectorEmpty>No languages found</LanguageSelectorEmpty>
          <LanguageSelectorOptions />
        </LanguageSelectorList>
      </LanguageSelectorContent>
    </LanguageSelector>
  );
}

export const SearchWithNoResults: Story = {
  render: () => <NoResultsExample />,
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    const user = userEvent.setup();

    await user.type(body.getByRole("combobox", { name: "Search languages" }), "not a language");
  },
};

import type { Meta, StoryObj } from "@storybook/react-vite";
import { BookOpen, Palette, Sparkles } from "lucide-react";
import { useState } from "react";

import { Separator } from "@/components/ui/separator";

import {
  Library,
  LibraryContent,
  LibraryNavigation,
  LibraryNavigationGroup,
  LibraryNavigationItem,
  LibraryPage,
} from "@/components/library";

const meta = {
  title: "Design System/Library",
  component: Library,
  parameters: { layout: "padded" },
} satisfies Meta<typeof Library>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Navigation: Story = {
  render: function Render() {
    const [value, setValue] = useState("general");
    return (
      <div className="flex h-96 max-w-3xl overflow-hidden rounded-lg border bg-background p-4">
        <Library onValueChange={setValue} value={value}>
          <LibraryNavigation aria-label="Settings pages">
            <LibraryNavigationGroup label="Preferences">
              <LibraryNavigationItem indicator={<BookOpen />} value="general">
                General
              </LibraryNavigationItem>
              <LibraryNavigationItem indicator={<Palette />} value="appearance">
                Appearance
              </LibraryNavigationItem>
            </LibraryNavigationGroup>
            <LibraryNavigationGroup label="Information">
              <LibraryNavigationItem indicator={<Sparkles />} value="about">
                About / Updates
              </LibraryNavigationItem>
            </LibraryNavigationGroup>
          </LibraryNavigation>
          <Separator orientation="vertical" />
          <LibraryContent>
            <LibraryPage hidden={value !== "general"} value="general">
              <h2 className="text-lg font-semibold">General</h2>
              <p className="mt-2 text-muted-foreground">Choose how EasyTrim works for you.</p>
            </LibraryPage>
            <LibraryPage hidden={value !== "appearance"} value="appearance">
              <h2 className="text-lg font-semibold">Appearance</h2>
              <p className="mt-2 text-muted-foreground">Adjust the editor appearance.</p>
            </LibraryPage>
            <LibraryPage hidden={value !== "about"} value="about">
              <h2 className="text-lg font-semibold">About / Updates</h2>
              <p className="mt-2 text-muted-foreground">Application details and help.</p>
            </LibraryPage>
          </LibraryContent>
        </Library>
      </div>
    );
  },
};

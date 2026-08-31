import type { Meta, StoryObj } from "@storybook/react";
import { Check, CircleAlert, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { Button } from "../button";
import { Toaster } from "../sonner";

const meta = {
  component: Toaster,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  title: "Design System/Sonner",
} satisfies Meta<typeof Toaster>;

export default meta;

type Story = StoryObj<typeof meta>;

function StoryShell({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="flex flex-wrap justify-center gap-2">{children}</div>
      <Toaster duration={10000} position="top-center" theme="light" />
    </>
  );
}

export const Default: Story = {
  render: () => (
    <StoryShell>
      <Button onClick={() => toast("A new notification is available.")}>Show toast</Button>
    </StoryShell>
  ),
};

export const Success: Story = {
  render: () => (
    <StoryShell>
      <Button
        onClick={() =>
          toast.success("File saved", {
            description: "example.mp4 is ready to use.",
            icon: <Check aria-hidden="true" />,
          })
        }
      >
        Show success
      </Button>
    </StoryShell>
  ),
};

export const Error: Story = {
  render: () => (
    <StoryShell>
      <Button
        onClick={() =>
          toast.error("File could not be saved", {
            description: "Check the file permissions and try again.",
            icon: <CircleAlert aria-hidden="true" />,
          })
        }
        variant="destructive"
      >
        Show error
      </Button>
    </StoryShell>
  ),
};

export const LoadingPromise: Story = {
  render: () => (
    <StoryShell>
      <Button
        onClick={() => {
          const operation = new Promise((resolve) => window.setTimeout(resolve, 1200));
          toast.promise(operation, {
            loading: "Preparing file…",
            success: "File is ready",
            error: "The file could not be prepared",
          });
        }}
      >
        Show promise
      </Button>
    </StoryShell>
  ),
};

export const Action: Story = {
  render: () => (
    <StoryShell>
      <Button
        onClick={() =>
          toast.warning("Source moved to the trash", {
            action: {
              label: "Restore",
              onClick: () => toast.success("Source restored"),
            },
            icon: <TriangleAlert aria-hidden="true" />,
          })
        }
      >
        Show action
      </Button>
    </StoryShell>
  ),
};

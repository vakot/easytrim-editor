import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";

import { splashMessages } from "../../../../lib/splash-messages";
import { PreviewSplash } from "../PreviewSplash";

const meta = {
  component: PreviewSplash,
  parameters: { layout: "fullscreen" },
  tags: ["autodocs"],
  title: "Features/Preview/Empty Preview Splash",
} satisfies Meta<typeof PreviewSplash>;

export default meta;

type Story = StoryObj<typeof meta>;

export const AllMessages: Story = {
  render: () => (
    <div className="grid justify-items-start gap-12 p-12">
      {splashMessages.map((message) => (
        <PreviewSplash className="static!" key={message.id} message={message} />
      ))}
    </div>
  ),
};

function RandomSplashStory() {
  const [key, setKey] = useState(0);

  return (
    <div className="relative m-12 h-48 w-lg max-w-[calc(100vw-6rem)] border bg-preview-surface">
      <PreviewSplash key={key} />
      <button
        className="absolute bottom-4 left-4 rounded border px-3 py-1 text-sm"
        onClick={() => setKey((value) => value + 1)}
        type="button"
      >
        Pick another message
      </button>
    </div>
  );
}

export const RandomSelection: Story = {
  render: () => <RandomSplashStory />,
};

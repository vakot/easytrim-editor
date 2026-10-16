import type { Meta, StoryObj } from "@storybook/react";

import { type SplashMessageDefinition, splashMessages } from "../../../../lib/splash-messages";
import { PreviewSplash } from "../PreviewSplash";

const meta = {
  component: PreviewSplash,
  parameters: { layout: "fullscreen" },
  tags: ["autodocs"],
  title: "Features/Preview/Preview Splash",
} satisfies Meta<typeof PreviewSplash>;

export default meta;

type Story = StoryObj<typeof meta>;

function SplashMessagesColumn({ messages }: { messages: SplashMessageDefinition[] }) {
  if (messages.length === 0) {
    return (
      <section className="relative m-12 flex h-48 items-center justify-center">
        <p className="text-sm text-muted-foreground">No messages in this rarity yet.</p>
      </section>
    );
  }

  return (
    <section className="relative m-12 grid justify-items-center gap-8">
      {messages.map((message) => (
        <PreviewSplash className="static! translate-none" key={message.id} message={message} />
      ))}
    </section>
  );
}

function MessagesByRarity({ rarity }: { rarity: SplashMessageDefinition["rarity"] }) {
  const messages = splashMessages.filter((message) => message.rarity === rarity);

  return <SplashMessagesColumn messages={messages} />;
}

export const AllMessages: Story = {
  render: () => <SplashMessagesColumn messages={splashMessages} />,
};

export const Common: Story = {
  render: () => <MessagesByRarity rarity="common" />,
};

export const Uncommon: Story = {
  render: () => <MessagesByRarity rarity="uncommon" />,
};

export const Rare: Story = {
  render: () => <MessagesByRarity rarity="rare" />,
};

export const Legendary: Story = {
  render: () => <MessagesByRarity rarity="legendary" />,
};

function RandomSplashStory() {
  return (
    <div className="relative m-12 flex h-48 items-center justify-center">
      <PreviewSplash className="static! translate-none" />
    </div>
  );
}

export const RandomSelection: Story = {
  render: () => <RandomSplashStory />,
};

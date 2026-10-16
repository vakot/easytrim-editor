import type { Meta, StoryObj } from "@storybook/react";

import {
  splashMessagesCommon,
  splashMessagesLegendary,
  splashMessagesRare,
  splashMessagesUncommon,
} from "../../consts/splash-messages.consts";
import type { SplashMessageDefinition } from "../../types/splash-messages.types";
import { SplashMessages } from "../SplashMessages";

const splashMessages: SplashMessageDefinition[] = [
  ...splashMessagesCommon,
  ...splashMessagesUncommon,
  ...splashMessagesRare,
  ...splashMessagesLegendary,
];

const meta = {
  component: SplashMessages,
  parameters: { layout: "fullscreen" },
  tags: ["autodocs"],
  title: "Features/Entertainment/Splash Messages",
} satisfies Meta<typeof SplashMessages>;

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
        <SplashMessages className="static! translate-none" key={message.id} message={message} />
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
      <SplashMessages className="static! translate-none" />
    </div>
  );
}

export const RandomSelection: Story = {
  render: () => <RandomSplashStory />,
};

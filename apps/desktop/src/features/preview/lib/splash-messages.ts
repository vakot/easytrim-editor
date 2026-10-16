import type { ReactNode } from "react";

type SplashRarity = "common" | "uncommon" | "rare" | "legendary";

type SplashMessageDefinition<T extends SplashRarity = SplashRarity> = {
  className?: string;
  id: string;
  rarity: T;
  render?: () => ReactNode;
  text: string;
};

const splashRarityWeights: Record<SplashRarity, number> = {
  common: 12,
  uncommon: 4,
  rare: 1,
  legendary: 0.25,
};

const splashMessagesCommon = [
  { id: "ffmpeg", text: "Powered by FFmpeg!", rarity: "common" },
  { id: "lossless", text: "Lossless means lossless!", rarity: "common" },
  { id: "trim-first", text: "Trim first, regret never!", rarity: "common" },
  { id: "second-chances", text: "Undo believes in second chances!", rarity: "common" },
  { id: "cutting-corners", text: "Cutting videos, not corners!", rarity: "common" },
  { id: "more-trimming", text: "Now with 100% more trimming!", rarity: "common" },
] satisfies SplashMessageDefinition<"common">[];

const splashMessagesUncommon = [
  { id: "frame-perfect", text: "Frame perfect. Probably.", rarity: "uncommon" },
  { id: "works-on-my-machine", text: "Works on my machine™", rarity: "uncommon" },
] satisfies SplashMessageDefinition<"uncommon">[];

const splashMessagesRare = [
  { id: "no-electron", text: "No Electron detected!", rarity: "rare" },
  { id: "empty-state", text: "You found the empty state!", rarity: "rare" },
] satisfies SplashMessageDefinition<"rare">[];

const splashMessagesLegendary = [] satisfies SplashMessageDefinition<"legendary">[];

const splashMessages: SplashMessageDefinition[] = [
  ...splashMessagesCommon,
  ...splashMessagesUncommon,
  ...splashMessagesRare,
  ...splashMessagesLegendary,
];

let lastSelectedMessageId: string | undefined;

/** Selects by rarity weight, skips the prior message when possible, and remembers the choice. */
function chooseSplashMessage(previousId = lastSelectedMessageId): SplashMessageDefinition {
  const candidates = splashMessages.filter((message) => message.id !== previousId);
  const available = candidates.length > 0 ? candidates : splashMessages;
  const totalWeight = available.reduce(
    (total, message) => total + splashRarityWeights[message.rarity ?? "common"],
    0,
  );

  let selection = Math.random() * totalWeight;

  for (const message of available) {
    selection -= splashRarityWeights[message.rarity ?? "common"];
    if (selection < 0) {
      lastSelectedMessageId = message.id;
      return message;
    }
  }

  const message = available[available.length - 1]!;
  lastSelectedMessageId = message.id;
  return message;
}

export { chooseSplashMessage, splashMessages };
export type { SplashMessageDefinition };

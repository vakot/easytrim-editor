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

const splashMessagesByRarity: Record<SplashRarity, SplashMessageDefinition[]> = {
  common: splashMessagesCommon,
  uncommon: splashMessagesUncommon,
  rare: splashMessagesRare,
  legendary: splashMessagesLegendary,
};

const splashMessages = Object.values(splashMessagesByRarity).flat();

const splashMessageHistory: string[] = [];
const splashMessageHistoryLimit = 3;

function chooseSplashMessage(): SplashMessageDefinition {
  const rarities = (Object.keys(splashRarityWeights) as SplashRarity[]).filter((rarity) =>
    splashMessagesByRarity[rarity].some((message) => !splashMessageHistory.includes(message.id)),
  );

  let selection =
    Math.random() * rarities.reduce((total, rarity) => total + splashRarityWeights[rarity], 0);

  const rarity =
    rarities.find((rarity) => (selection -= splashRarityWeights[rarity]) < 0) ?? rarities[0]!;

  const messages = splashMessagesByRarity[rarity].filter(
    (message) => !splashMessageHistory.includes(message.id),
  );

  const message = messages[Math.floor(Math.random() * messages.length)]!;

  splashMessageHistory.push(message.id);

  if (splashMessageHistory.length > splashMessageHistoryLimit) {
    splashMessageHistory.shift();
  }

  return message;
}

export { chooseSplashMessage, splashMessages };
export type { SplashMessageDefinition };

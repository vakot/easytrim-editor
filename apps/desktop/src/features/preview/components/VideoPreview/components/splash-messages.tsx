import type { ReactNode } from "react";

type SplashRarity = "common" | "uncommon" | "rare" | "legendary";

type SplashMessageDefinition = {
  animationClassName?: string;
  id: string;
  rarity?: SplashRarity;
  render?: () => ReactNode;
  text: string;
};

const splashRarityWeights: Record<SplashRarity, number> = {
  common: 12,
  uncommon: 4,
  rare: 1,
  legendary: 0.25,
};

const splashMessages: SplashMessageDefinition[] = [
  { id: "ffmpeg", text: "Powered by FFmpeg!" },
  { id: "lossless", text: "Lossless means lossless!" },
  { id: "trim-first", text: "Trim first, regret never!" },
  { id: "frame-perfect", text: "Frame perfect. Probably.", rarity: "uncommon" },
  { id: "works-on-my-machine", text: "Works on my machine™", rarity: "uncommon" },
  { id: "no-electron", text: "No Electron detected!", rarity: "rare" },
  { id: "second-chances", text: "Undo believes in second chances!" },
  { id: "cutting-corners", text: "Cutting videos, not corners!" },
  { id: "more-trimming", text: "Now with 100% more trimming!" },
  { id: "empty-state", text: "You found the empty state!", rarity: "rare" },
];

let lastSelectedMessageId: string | undefined;

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

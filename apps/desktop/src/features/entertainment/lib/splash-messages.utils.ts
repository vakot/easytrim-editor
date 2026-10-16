import {
  splashMessagesCommon,
  splashMessagesLegendary,
  splashMessagesRare,
  splashMessagesUncommon,
} from "../consts/splash-messages.consts";
import type { SplashMessageDefinition, SplashRarity } from "../types/splash-messages.types";

const splashRarityWeights: Record<SplashRarity, number> = {
  common: 12,
  uncommon: 4,
  rare: 1,
  legendary: 0.25,
};

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

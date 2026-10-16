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

let lastSplashMessageId: string | null = null;

function chooseSplashMessage(): SplashMessageDefinition {
  const availableByRarity = Object.entries(splashMessagesByRarity).map(([rarity, messages]) => ({
    rarity: rarity as SplashRarity,
    messages: messages.filter((message) => message.id !== lastSplashMessageId),
  }));

  const availableRarities = availableByRarity.filter(({ messages }) => messages.length > 0);

  let selection =
    Math.random() *
    availableRarities.reduce((total, { rarity }) => total + splashRarityWeights[rarity], 0);

  const selectedRarity =
    availableRarities.find(({ rarity }) => (selection -= splashRarityWeights[rarity]) < 0) ??
    availableRarities[0]!;

  const message =
    selectedRarity.messages[Math.floor(Math.random() * selectedRarity.messages.length)]!;

  lastSplashMessageId = message.id;

  return message;
}

export { chooseSplashMessage, splashMessages };
export type { SplashMessageDefinition };

type SplashRarity = "common" | "uncommon" | "rare" | "legendary";

type SplashMessageDefinition<T extends SplashRarity = SplashRarity> = {
  className?: string;
  id: string;
  rarity: T;
  render?: () => React.ReactNode;
  text: string;
};

export type { SplashMessageDefinition, SplashRarity };

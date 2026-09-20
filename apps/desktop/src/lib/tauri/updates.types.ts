interface AvailableUpdate {
  install: () => Promise<void>;
  version: string;
}

export type { AvailableUpdate };

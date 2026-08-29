export interface AvailableUpdate {
  version: string;
  install: () => Promise<void>;
}

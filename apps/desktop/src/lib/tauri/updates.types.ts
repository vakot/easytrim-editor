export interface AvailableUpdate {
  install: () => Promise<void>;
  version: string;
}

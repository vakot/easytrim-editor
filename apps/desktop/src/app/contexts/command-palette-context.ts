import { createContext, useContext } from "react";

interface CommandPaletteContextValue {
  closeCommandPalette: () => void;
  isCommandPaletteOpen: boolean;
  openCommandPalette: () => void;
  sessionId: number;
  toggleCommandPalette: () => void;
}

const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(null);

function useCommandPalette(): CommandPaletteContextValue {
  const context = useContext(CommandPaletteContext);
  if (!context) throw new Error("useCommandPalette must be used within CommandPaletteProvider");
  return context;
}

export { CommandPaletteContext, useCommandPalette };
export type { CommandPaletteContextValue };

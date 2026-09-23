import { createContext, useContext } from "react";

interface ChangelogDialogContextValue {
  openChangelog: () => void;
}

const ChangelogDialogContext = createContext<ChangelogDialogContextValue | null>(null);

function useChangelogDialog(): ChangelogDialogContextValue {
  const context = useContext(ChangelogDialogContext);
  if (!context) throw new Error("useChangelogDialog must be used within ChangelogProvider");
  return context;
}

export { ChangelogDialogContext, useChangelogDialog };
export type { ChangelogDialogContextValue };

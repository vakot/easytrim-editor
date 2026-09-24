import { createContext, useContext } from "react";

interface QueueDeleteSourceContextValue {
  requestEnableSourceDeletion: () => void;
}

const QueueDeleteSourceContext = createContext<QueueDeleteSourceContextValue | null>(null);

function useQueueDeleteSource(): QueueDeleteSourceContextValue {
  const context = useContext(QueueDeleteSourceContext);
  if (!context) throw new Error("useQueueDeleteSource must be used within QueueDeleteSourceProvider");
  return context;
}

export { QueueDeleteSourceContext, useQueueDeleteSource };
export type { QueueDeleteSourceContextValue };

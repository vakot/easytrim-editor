import { createContext } from "react";

type RegisterThumbnailDemand = (
  element: Element,
  request: () => void,
  release: () => void,
) => () => void;

const SourceListThumbnailDemandContext = createContext<RegisterThumbnailDemand | null>(null);

export { SourceListThumbnailDemandContext };
export type { RegisterThumbnailDemand };

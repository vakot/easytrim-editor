import { useContext } from "react";

import { SourceCardContext } from "../contexts/SourceCardContext";

function useSourceCardData() {
  const context = useContext(SourceCardContext);

  if (!context) {
    throw new Error(
      "SourceCardThumbnail, SourceCardDetails, SourceCardTitle, SourceCardDescription, SourceCardMetadata, SourceCardActions and SourceCardContextMenu must be used within SourceCard",
    );
  }

  return context;
}

export { useSourceCardData };

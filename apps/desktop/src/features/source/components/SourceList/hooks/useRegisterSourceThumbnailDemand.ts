import { useContext } from "react";

import { SourceListThumbnailDemandContext } from "../contexts/SourceListThumbnailDemandContext";

function useRegisterSourceThumbnailDemand() {
  return useContext(SourceListThumbnailDemandContext);
}

export { useRegisterSourceThumbnailDemand };

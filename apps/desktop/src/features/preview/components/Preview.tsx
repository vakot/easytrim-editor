import { useAppSelector } from "@/app/store/redux-hooks";
import { selectSourceSelection } from "@/app/store/slices/source-slice";

import { VideoPreview, VideoPreviewEmpty, VideoPreviewLoadingOverlay } from "./VideoPreview";

function Preview() {
  const sourceSelection = useAppSelector(selectSourceSelection);

  return (
    <div className="relative isolate flex-1" data-slot="preview-content">
      {sourceSelection === null ? <VideoPreviewEmpty /> : <VideoPreview />}

      <VideoPreviewLoadingOverlay />
    </div>
  );
}

export { Preview };

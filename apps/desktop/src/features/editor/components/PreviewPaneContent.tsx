import type { ComponentProps } from "react";

import { VideoPreview } from "@/features/preview/VideoPreview";

export type PreviewPaneContentProps = ComponentProps<typeof VideoPreview>;

export function PreviewPaneContent(props: PreviewPaneContentProps) {
  return <VideoPreview {...props} />;
}

import type { LucideIcon } from "lucide-react";
import { AudioLines, FileImage, Film } from "lucide-react";

import type { ExportRoute } from "@/domain/editing-instance";

const exportRouteIcons: Record<ExportRoute, LucideIcon> = {
  audio: AudioLines,
  fast: Film,
  gif: FileImage,
  optimized: Film,
};

function ExportQueueItemRouteIcon({
  className,
  route,
}: {
  className?: string;
  route: ExportRoute;
}) {
  const Icon = exportRouteIcons[route];
  return <Icon aria-hidden="true" className={className} />;
}

export { ExportQueueItemRouteIcon };

import type { LucideIcon } from "lucide-react";
import { FileImage, Film } from "lucide-react";

import type { ExportRoute } from "@/domain/editing-instance";

const exportRouteIcons: Record<ExportRoute, LucideIcon> = {
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

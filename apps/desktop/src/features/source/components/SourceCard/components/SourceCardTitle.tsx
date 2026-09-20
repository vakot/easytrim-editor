import { CardTitle } from "@/components/ui/card";

import { cn } from "@/lib/class-names.utils";

import { useSourceCardData } from "../hooks/useSourceCardData";
import type { SourceCardContent } from "../types";

function SourceCardTitle({
  children,
  className,
}: {
  children?: SourceCardContent;
  className?: string;
}) {
  const source = useSourceCardData();
  const { displayName } = source.snapshot.source;
  const content = children ? children({ source }) : displayName;

  return (
    <CardTitle className={cn("truncate text-sm", className)} title={displayName}>
      {content}
    </CardTitle>
  );
}

export { SourceCardTitle };

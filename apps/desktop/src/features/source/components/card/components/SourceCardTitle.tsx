import { CardTitle } from "@/components/ui/card";

import { cn } from "@/lib/class-names.utils";

import { useSourceCardSource } from "../hooks/useSourceCardSource";
import type { SourceCardContent } from "../types";

function SourceCardTitle({
  children,
  className,
}: {
  children?: SourceCardContent;
  className?: string;
}) {
  const source = useSourceCardSource();
  const { displayName } = source.snapshot.source;
  const content = children ? children({ source }) : displayName;

  return (
    <CardTitle className={cn("truncate text-sm", className)} title={displayName}>
      {content}
    </CardTitle>
  );
}

export { SourceCardTitle };

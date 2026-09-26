import { CardDescription } from "@/components/ui/card";

import { cn } from "@/lib/class-names.utils";

import { formatSourcePath } from "../../../lib/media-formatters.utils";
import { useSourceCardData } from "../hooks/useSourceCardData";
import type { SourceCardContent } from "../types";

function SourceCardDescription({
  children,
  className,
}: {
  children?: SourceCardContent;
  className?: string;
}) {
  const source = useSourceCardData();
  const { sourcePath } = source;
  const content = children ? children({ source }) : formatSourcePath(sourcePath);

  return (
    <CardDescription className={cn("truncate", className)} title={sourcePath}>
      {content}
    </CardDescription>
  );
}

export { SourceCardDescription };

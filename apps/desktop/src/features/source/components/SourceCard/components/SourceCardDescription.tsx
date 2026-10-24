import { CardDescription } from "@easytrim-editor/ui/card";
import { cn } from "@easytrim-editor/ui/class-names";

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

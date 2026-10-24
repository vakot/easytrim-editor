import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@easytrim-editor/ui/class-names";

import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item";

function UsageStatisticsItem({
  description,
  icon,
  label,
  value,
  valueClassName,
  valueIcon: ValueIcon,
}: {
  description?: string;
  icon: ReactNode;
  label: string;
  value: string;
  valueClassName?: string;
  valueIcon?: LucideIcon;
}) {
  return (
    <Item className="items-start" role="listitem" size="sm" variant="outline">
      <ItemMedia
        aria-hidden="true"
        className="rounded-md bg-muted p-2 text-muted-foreground"
        variant="icon"
      >
        {icon}
      </ItemMedia>
      <ItemContent className="min-w-0 gap-0.5">
        <ItemTitle className="font-normal text-muted-foreground">{label}</ItemTitle>
        <p
          className={cn(
            "truncate text-lg leading-tight font-semibold tabular-nums",
            valueClassName,
          )}
        >
          <span className="inline-flex items-center gap-0.5">
            {value}
            {ValueIcon ? <ValueIcon aria-hidden="true" className="size-3 shrink-0" /> : null}
          </span>
        </p>
        {description ? <ItemDescription className="text-xs">{description}</ItemDescription> : null}
      </ItemContent>
    </Item>
  );
}

export { UsageStatisticsItem };

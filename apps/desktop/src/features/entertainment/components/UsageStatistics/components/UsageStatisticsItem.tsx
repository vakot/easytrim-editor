import type { ReactNode } from "react";

import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item";

import { cn } from "@/lib/class-names.utils";

function UsageStatisticsItem({
  description,
  icon,
  label,
  value,
  valueClassName,
}: {
  description?: string;
  icon: ReactNode;
  label: string;
  value: string;
  valueClassName?: string;
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
          {value}
        </p>
        {description ? <ItemDescription className="text-xs">{description}</ItemDescription> : null}
      </ItemContent>
    </Item>
  );
}

export { UsageStatisticsItem };

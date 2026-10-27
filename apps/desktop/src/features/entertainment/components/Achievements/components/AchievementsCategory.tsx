import { type ReactNode, useId } from "react";

import { cn } from "@easytrim-editor/ui/class-names";

import { ItemGroup } from "@/components/ui/item";

function AchievementsCategory({
  children,
  compact = false,
  title,
}: {
  children: ReactNode;
  compact?: boolean;
  title: string;
}) {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <h3 className="text-xs font-medium text-muted-foreground" id={headingId}>
        {title}
      </h3>
      <ItemGroup
        className={cn(
          "grid gap-2",
          compact ? "grid-cols-1" : "grid-cols-[repeat(auto-fill,minmax(min(100%,16rem),1fr))]",
        )}
      >
        {children}
      </ItemGroup>
    </section>
  );
}

export { AchievementsCategory };

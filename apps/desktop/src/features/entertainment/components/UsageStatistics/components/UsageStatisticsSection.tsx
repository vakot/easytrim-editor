import { type ReactNode, useId } from "react";

import { ItemGroup } from "@easytrim-editor/ui/item";

function UsageStatisticsSection({ children, title }: { children: ReactNode; title: string }) {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <h3 className="text-xs font-medium text-muted-foreground" id={headingId}>
        {title}
      </h3>
      <ItemGroup className="grid grid-cols-[repeat(auto-fit,minmax(14rem,1fr))] gap-2">
        {children}
      </ItemGroup>
    </section>
  );
}

export { UsageStatisticsSection };

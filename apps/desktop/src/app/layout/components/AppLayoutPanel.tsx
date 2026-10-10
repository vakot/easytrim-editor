import { Card } from "@/components/ui/card";

import { cn } from "@/lib/class-names.utils";

interface AppLayoutPanelProps {
  children?: React.ReactNode;
  className?: string;
  layoutRegion?: string;
}

function AppLayoutPanel({ children, className, layoutRegion }: AppLayoutPanelProps) {
  return (
    <Card
      className={cn(
        "size-full min-h-0 min-w-0 gap-0 border border-border p-0 ring-0 layout-compact:rounded-none layout-compact:border-0",
        className,
      )}
      data-layout-region={layoutRegion}
    >
      {children}
    </Card>
  );
}

export { AppLayoutPanel };

import type { ComponentProps, ReactNode } from "react";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { cn } from "@/lib/class-names.utils";

type LibraryProps = ComponentProps<typeof Tabs>;

function Library({ className, ...props }: LibraryProps) {
  return (
    <Tabs
      className={cn("-mx-4 flex min-h-0 min-w-0 flex-1 gap-4", className)}
      orientation="vertical"
      {...props}
    />
  );
}

interface LibraryNavigationProps extends ComponentProps<typeof TabsList> {
  "aria-label": string;
}

function LibraryNavigation({ className, ...props }: LibraryNavigationProps) {
  return (
    <ScrollArea className="-mx-2 h-full min-h-0 min-w-0 pl-4">
      <TabsList className={cn("bg-transparent px-0 pt-2.5 pb-4", className)} {...props} />
    </ScrollArea>
  );
}

function LibrarySeparator() {
  return <Separator orientation="vertical" />;
}

function LibraryNavigationGroup({ children, label }: { children: ReactNode; label?: ReactNode }) {
  return (
    <div className="flex w-full flex-col">
      {label ? (
        <div aria-hidden="true" className="px-2.5 py-1.5 text-xs font-medium text-muted-foreground">
          {label}
        </div>
      ) : null}
      {children}
    </div>
  );
}

interface LibraryNavigationItemProps extends ComponentProps<typeof TabsTrigger> {
  indicator?: ReactNode;
  trailingIndicator?: ReactNode;
}

function LibraryNavigationItem({
  children,
  className,
  indicator,
  trailingIndicator,
  ...props
}: LibraryNavigationItemProps) {
  return (
    <TabsTrigger className={cn("relative h-7 min-w-0 flex-none px-8", className)} {...props}>
      {indicator ? <LibraryItemIndicator side="left">{indicator}</LibraryItemIndicator> : null}
      <span className="min-w-0 truncate text-left">{children}</span>
      {trailingIndicator ? (
        <LibraryItemIndicator side="right">{trailingIndicator}</LibraryItemIndicator>
      ) : null}
    </TabsTrigger>
  );
}

function LibraryItemIndicator({ children, side }: { children: ReactNode; side: "left" | "right" }) {
  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute top-1/2 flex size-4 -translate-y-1/2 items-center justify-center text-muted-foreground ${side === "left" ? "left-2" : "right-2"}`}
    >
      {children}
    </span>
  );
}

type LibraryContentProps = ComponentProps<"div">;

function LibraryContent({ className, ...props }: LibraryContentProps) {
  return (
    <ScrollArea className="h-full min-h-0 min-w-0 flex-1">
      <div className={cn("py-4 pr-4", className)} {...props} />
    </ScrollArea>
  );
}

interface LibraryPageProps extends ComponentProps<typeof TabsContent> {
  hidden: boolean;
}

function LibraryPage({ children, forceMount = true, hidden, ...props }: LibraryPageProps) {
  return (
    <TabsContent
      className="data-[state=inactive]:hidden"
      forceMount={forceMount}
      hidden={hidden}
      {...props}
    >
      {children}
    </TabsContent>
  );
}

export {
  Library,
  LibraryContent,
  LibraryNavigation,
  LibraryNavigationGroup,
  LibraryNavigationItem,
  LibraryPage,
  LibrarySeparator,
};

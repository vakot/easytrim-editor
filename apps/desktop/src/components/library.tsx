"use client";

import { MenuIcon } from "@/components/ui/menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { cn } from "@/lib/class-names.utils";

function Library({ className, ...props }: React.ComponentProps<typeof Tabs>) {
  return (
    <Tabs
      className={cn("flex min-h-0 min-w-0 flex-1 gap-0", className)}
      orientation="vertical"
      {...props}
    />
  );
}

function LibraryNavigation({
  children,
  className,
  ...props
}: React.ComponentProps<typeof TabsList>) {
  return (
    <TabsList
      className={cn(
        "min-h-0 min-w-0 bg-transparent p-0 group-data-vertical/tabs:h-full",
        className,
      )}
      {...props}
    >
      <ScrollArea className="size-full min-h-0 min-w-0" fadeColor="var(--popover)">
        <div className="p-4">{children}</div>
      </ScrollArea>
    </TabsList>
  );
}

function LibraryNavigationGroup({
  children,
  className,
  label,
  ...props
}: React.ComponentProps<"div"> & {
  label?: React.ReactNode;
}) {
  return (
    <div className={cn("flex w-full flex-col", className)} {...props}>
      {label ? (
        <div aria-hidden="true" className="px-2.5 py-1.5 text-xs font-medium text-muted-foreground">
          {label}
        </div>
      ) : null}
      {children}
    </div>
  );
}

function LibraryNavigationItem({ className, ...props }: React.ComponentProps<typeof TabsTrigger>) {
  return (
    <TabsTrigger
      className={cn("relative h-8 min-w-48 flex-none truncate px-2.5 text-left", className)}
      {...props}
    />
  );
}

function LibraryNavigationItemIndicator({ children, side }: React.ComponentProps<typeof MenuIcon>) {
  return <MenuIcon side={side}>{children}</MenuIcon>;
}

function LibraryContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <ScrollArea className="h-full min-h-0 min-w-0 flex-1" fadeColor="var(--popover)">
      <div className={cn("p-4", className)} {...props} />
    </ScrollArea>
  );
}

function LibraryPage({ children, className, ...props }: React.ComponentProps<typeof TabsContent>) {
  return (
    <TabsContent className={cn("data-[state=inactive]:hidden", className)} {...props}>
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
  LibraryNavigationItemIndicator,
  LibraryPage,
};

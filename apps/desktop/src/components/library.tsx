import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MenuIcon } from "@/components/ui/menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { cn } from "@/lib/class-names.utils";

function LibraryDialog({ ...props }: React.ComponentProps<typeof Dialog>) {
  return <Dialog {...props} />;
}

function LibraryDialogContent({ className, ...props }: React.ComponentProps<typeof DialogContent>) {
  return (
    <DialogContent
      className={cn(
        "h-full max-h-[min(80dvh,32rem)] grid-rows-[auto_minmax(0,1fr)_auto_auto] gap-0 overflow-hidden pb-0 sm:max-w-3xl",
        className,
      )}
      {...props}
    />
  );
}

function LibraryDialogHeader({ className, ...props }: React.ComponentProps<typeof DialogHeader>) {
  return <DialogHeader className={cn("-mx-4 border-b px-4 pb-4", className)} {...props} />;
}

function LibraryDialogTitle({ ...props }: React.ComponentProps<typeof DialogTitle>) {
  return <DialogTitle {...props} />;
}

function LibraryDialogDescription({ ...props }: React.ComponentProps<typeof DialogDescription>) {
  return <DialogDescription {...props} />;
}

function LibraryDialogFooter({ className, ...props }: React.ComponentProps<typeof DialogFooter>) {
  return <DialogFooter className={cn("mb-0", className)} {...props} />;
}

function LibraryDialogClose({ ...props }: React.ComponentProps<typeof DialogClose>) {
  return <DialogClose {...props} />;
}

function Library({ className, ...props }: React.ComponentProps<typeof Tabs>) {
  return (
    <Tabs
      className={cn("-mx-4 flex min-h-0 min-w-0 flex-1 gap-4", className)}
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
    <TabsList className={cn("bg-transparent px-0 py-4", className)} {...props}>
      <ScrollArea className="h-full min-h-0 min-w-0 pl-4">{children}</ScrollArea>
    </TabsList>
  );
}

function LibrarySeparator() {
  return <Separator orientation="vertical" />;
}

function LibraryNavigationGroup({
  children,
  label,
}: {
  children: React.ReactNode;
  label?: React.ReactNode;
}) {
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

function LibraryNavigationItem({ className, ...props }: React.ComponentProps<typeof TabsTrigger>) {
  return (
    <TabsTrigger
      className={cn("relative h-7 min-w-48 flex-none truncate px-2.5 text-left", className)}
      {...props}
    />
  );
}

function LibraryNavigationItemIndicator({ children, side }: React.ComponentProps<typeof MenuIcon>) {
  return <MenuIcon side={side}>{children}</MenuIcon>;
}

function LibraryContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <ScrollArea className="h-full min-h-0 min-w-0 flex-1">
      <div className={cn("py-4 pr-4", className)} {...props} />
    </ScrollArea>
  );
}

function LibraryPage({ children, ...props }: React.ComponentProps<typeof TabsContent>) {
  return (
    <TabsContent className="data-[state=inactive]:hidden" {...props}>
      {children}
    </TabsContent>
  );
}

export {
  Library,
  LibraryContent,
  LibraryDialog,
  LibraryDialogClose,
  LibraryDialogContent,
  LibraryDialogDescription,
  LibraryDialogFooter,
  LibraryDialogHeader,
  LibraryDialogTitle,
  LibraryNavigation,
  LibraryNavigationGroup,
  LibraryNavigationItem,
  LibraryNavigationItemIndicator,
  LibraryPage,
  LibrarySeparator,
};

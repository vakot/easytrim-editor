import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { cn } from "@/lib/class-names.utils";

function InputGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "group/input-group relative flex w-full flex-wrap items-center rounded-lg border border-input bg-transparent shadow-xs transition-[color,box-shadow] outline-none has-[[data-slot=input-group-control]:focus-visible]:border-ring has-[[data-slot=input-group-control]:focus-visible]:ring-3 has-[[data-slot=input-group-control]:focus-visible]:ring-ring/50 has-[[data-slot=input-group-control][aria-invalid=true]]:border-destructive has-[[data-slot=input-group-control][aria-invalid=true]]:ring-3 has-[[data-slot=input-group-control][aria-invalid=true]]:ring-destructive/20 dark:bg-input/30 dark:has-[[data-slot=input-group-control]:focus-visible]:border-ring dark:has-[[data-slot=input-group-control][aria-invalid=true]]:border-destructive/50 dark:has-[[data-slot=input-group-control][aria-invalid=true]]:ring-destructive/40",
        className,
      )}
      data-slot="input-group"
      role="group"
      {...props}
    />
  );
}

function InputGroupAddon({
  align = "inline-start",
  className,
  ...props
}: React.ComponentProps<"div"> & {
  align?: "inline-start" | "inline-end" | "block-start" | "block-end";
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-center gap-2 py-1.5 text-sm font-medium text-muted-foreground select-none [&>svg:not([class*='size-'])]:size-4",
        {
          "order-first pl-2.5": align === "inline-start",
          "order-last pr-2.5": align === "inline-end",
          "order-first basis-full border-b px-2.5": align === "block-start",
          "order-last basis-full border-t px-2.5": align === "block-end",
        },
        className,
      )}
      data-align={align}
      data-slot="input-group-addon"
      {...props}
    />
  );
}

function InputGroupButton({
  className,
  size = "sm",
  variant = "ghost",
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button
      className={className}
      data-slot="input-group-button"
      size={size}
      variant={variant}
      {...props}
    />
  );
}

function InputGroupText({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "flex items-center gap-2 px-2.5 text-sm text-muted-foreground [&>svg:not([class*='size-'])]:size-4",
        className,
      )}
      data-slot="input-group-text"
      {...props}
    />
  );
}

function InputGroupInput({ className, ...props }: React.ComponentProps<typeof Input>) {
  return (
    <Input
      className={cn(
        "flex h-7 min-w-0 flex-1 rounded-none border-0 bg-transparent px-2.5 py-1 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-transparent [&::-webkit-search-cancel-button]:appearance-none",
        className,
      )}
      data-slot="input-group-control"
      {...props}
    />
  );
}

function InputGroupTextarea({ className, ...props }: React.ComponentProps<typeof Textarea>) {
  return (
    <Textarea
      className={cn(
        "flex min-h-16 min-w-0 basis-full resize-none rounded-none border-0 bg-transparent px-2.5 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-transparent",
        className,
      )}
      data-slot="input-group-control"
      {...props}
    />
  );
}

export {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
  InputGroupTextarea,
};

import * as React from "react";

import { cn } from "@/lib/class-names.utils";

function Textarea({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "grid min-w-0 overflow-hidden rounded-lg border border-input bg-transparent transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 has-aria-invalid:border-destructive has-aria-invalid:ring-3 has-aria-invalid:ring-destructive/20 dark:has-aria-invalid:border-destructive/50 dark:has-aria-invalid:ring-destructive/40",
        className,
      )}
      data-slot="textarea"
      {...props}
    />
  );
}

function TextareaHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex min-h-7 items-center justify-between gap-2 bg-muted/30 px-2 py-0.5",
        className,
      )}
      data-slot="textarea-header"
      {...props}
    />
  );
}

function TextareaInput({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "flex field-sizing-content min-h-16 w-full min-w-0 resize-y border-0 bg-transparent px-2.5 py-2 text-base outline-none placeholder:text-muted-foreground focus-visible:ring-0 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80",
        className,
      )}
      data-slot="textarea-input"
      {...props}
    />
  );
}

export { Textarea, TextareaHeader, TextareaInput };

import { Toaster as Sonner, type ToasterProps } from "sonner";

import { cn } from "@/lib/class-names.utils";

function Toaster({ className, duration = 10000, toastOptions, ...props }: ToasterProps) {
  return (
    <Sonner
      className={cn("toaster group", className)}
      duration={duration}
      toastOptions={{
        ...toastOptions,
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-card group-[.toaster]:text-card-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          ...toastOptions?.classNames,
        },
      }}
      {...props}
    />
  );
}

export { Toaster };

import type { ComponentProps } from "react";

import { cn } from "@easytrim-editor/ui/class-names";

function Ribbon({ children, className, ...props }: ComponentProps<"span">) {
  return (
    <div className="pointer-events-none absolute top-0 right-0 z-20 flex size-32 translate-x-1/4 -translate-y-1/4 items-center justify-center">
      <span
        className={cn(
          "flex h-5 w-32 rotate-45 items-center justify-center px-3 text-center text-[0.625rem] leading-5 font-bold tracking-[0.12em] whitespace-nowrap shadow-sm",
          className,
        )}
        data-slot="corner-ribbon"
        {...props}
      >
        {children}
      </span>
    </div>
  );
}

export { Ribbon };

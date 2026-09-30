import { Loader2Icon } from "lucide-react";
import { useReducedMotion } from "motion/react";

import { cn } from "@/lib/class-names.utils";

function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  const shouldReduceMotion = useReducedMotion() === true;

  return (
    <Loader2Icon
      aria-label="Loading"
      className={cn("size-4", shouldReduceMotion !== true && "animate-spin", className)}
      data-slot="spinner"
      role="status"
      {...props}
    />
  );
}

export { Spinner };

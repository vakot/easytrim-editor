import { cn } from "@/lib/class-names.utils";

function Backdrop({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "fixed inset-0 isolate z-50 grid place-items-center bg-black/10 supports-backdrop-filter:backdrop-blur-xs",
        className,
      )}
      data-slot="backdrop"
      {...props}
    />
  );
}

export { Backdrop };

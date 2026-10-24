import { cn } from "../lib/class-names.utils";

function Ping({ className, ...props }: Omit<React.ComponentProps<"span">, "children">) {
  return (
    <span
      className={cn(
        "absolute top-0.5 right-0.5 z-10 size-2.5 translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow",
        "before:absolute before:inset-0 before:size-2.5 before:animate-ping before:rounded-full before:bg-primary before:content-['']",
        className,
      )}
      {...props}
    />
  );
}

export { Ping };

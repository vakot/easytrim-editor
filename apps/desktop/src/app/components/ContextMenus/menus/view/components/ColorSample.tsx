import { type PrimaryColor, resolvePrimaryColor } from "@/app/theme/theme";

const colorClasses: Record<Exclude<PrimaryColor, `#${string}`>, string> = {
  amber: "bg-[#efbf04]",
  rose: "bg-[#e85d75]",
  violet: "bg-[#8b6ee8]",
  blue: "bg-[#4299e1]",
  emerald: "bg-[#32a876]",
};

export function ColorSample({
  color,
  selected = false,
}: {
  color: PrimaryColor;
  selected?: boolean;
}) {
  const sampleClass = color.startsWith("#")
    ? undefined
    : colorClasses[color as Exclude<PrimaryColor, `#${string}`>];
  return (
    <span
      className={`size-3 rounded-full ring-1 ring-foreground/20 ${sampleClass ?? ""} ${selected ? "ring-2 ring-foreground ring-offset-1 ring-offset-popover" : ""}`}
      style={sampleClass ? undefined : { backgroundColor: resolvePrimaryColor(color) }}
      aria-hidden="true"
    />
  );
}

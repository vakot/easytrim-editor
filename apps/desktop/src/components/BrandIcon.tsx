import type { SVGProps } from "react";
import type { SimpleIcon } from "simple-icons";

interface BrandIconProps extends Omit<SVGProps<SVGSVGElement>, "children"> {
  icon: SimpleIcon;
}

export function BrandIcon({ icon, ...props }: BrandIconProps) {
  return (
    <svg
      {...props}
      aria-hidden={props["aria-hidden"] ?? true}
      data-brand-icon={icon.slug}
      fill="currentColor"
      focusable="false"
      viewBox="0 0 24 24"
    >
      <path d={icon.path} />
    </svg>
  );
}

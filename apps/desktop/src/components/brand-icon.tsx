import type { SVGProps } from "react";

export interface BrandIconDefinition {
  slug: string;
  path: string;
}

interface BrandIconProps extends Omit<SVGProps<SVGSVGElement>, "children"> {
  icon: BrandIconDefinition;
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

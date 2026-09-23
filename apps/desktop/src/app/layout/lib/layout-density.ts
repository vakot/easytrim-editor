const LAYOUT_DENSITIES = ["default", "compact"] as const;

type LayoutDensity = (typeof LAYOUT_DENSITIES)[number];

const DEFAULT_LAYOUT_DENSITY: LayoutDensity = "default";

function isLayoutDensity(value: unknown): value is LayoutDensity {
  return typeof value === "string" && LAYOUT_DENSITIES.includes(value as LayoutDensity);
}

export { DEFAULT_LAYOUT_DENSITY, isLayoutDensity, LAYOUT_DENSITIES };
export type { LayoutDensity };

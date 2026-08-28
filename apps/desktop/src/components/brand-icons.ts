import githubSvg from "simple-icons/icons/github.svg?raw";
import kofiSvg from "simple-icons/icons/kofi.svg?raw";

import type { BrandIconDefinition } from "./BrandIcon";

function createBrandIcon(slug: string, svg: string): BrandIconDefinition {
  const path = svg.match(/<path\b[^>]*\bd="([^"]+)"/)?.[1];
  if (!path) {
    throw new Error(`Simple Icon ${slug} does not contain a path`);
  }

  return { path, slug };
}

export const githubBrandIcon = createBrandIcon("github", githubSvg);
export const kofiBrandIcon = createBrandIcon("kofi", kofiSvg);

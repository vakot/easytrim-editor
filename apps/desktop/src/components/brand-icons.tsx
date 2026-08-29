import type { SVGProps } from "react";
import githubSvg from "simple-icons/icons/github.svg?raw";
import kofiSvg from "simple-icons/icons/kofi.svg?raw";

type BrandIconProps = Omit<SVGProps<SVGSVGElement>, "children">;

function createBrandIcon(slug: string, svg: string) {
  const path = svg.match(/<path\b[^>]*\bd="([^"]+)"/)?.[1];

  if (!path) {
    throw new Error(`Simple Icon ${slug} does not contain a path`);
  }

  function BrandIcon(props: BrandIconProps) {
    return (
      <svg
        {...props}
        aria-hidden={props["aria-hidden"] ?? true}
        data-brand-icon={slug}
        fill="currentColor"
        focusable="false"
        viewBox="0 0 24 24"
      >
        <path d={path} />
      </svg>
    );
  }

  BrandIcon.displayName = `${slug}Icon`;

  return BrandIcon;
}

export const GithubIcon = createBrandIcon("github", githubSvg);
export const KofiIcon = createBrandIcon("kofi", kofiSvg);

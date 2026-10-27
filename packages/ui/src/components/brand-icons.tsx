"use client";

import type { SVGProps } from "react";
import appleSvg from "simple-icons/icons/apple.svg?raw";
import githubSvg from "simple-icons/icons/github.svg?raw";
import kofiSvg from "simple-icons/icons/kofi.svg?raw";
import linuxSvg from "simple-icons/icons/linux.svg?raw";

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

const AppleIcon = createBrandIcon("apple", appleSvg);
const GithubIcon = createBrandIcon("github", githubSvg);
const KofiIcon = createBrandIcon("kofi", kofiSvg);
const LinuxIcon = createBrandIcon("linux", linuxSvg);
/** Simple Icons leaves out Microsoft's logos, so Windows gets a plain four-pane window. */
const WindowsIcon = createBrandIcon(
  "windows",
  '<path d="M2 2h9.5v9.5H2zM12.5 2H22v9.5h-9.5zM2 12.5h9.5V22H2zM12.5 12.5H22V22h-9.5z"/>',
);

export { AppleIcon, GithubIcon, KofiIcon, LinuxIcon, WindowsIcon };

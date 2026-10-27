import { Download, ExternalLink, LoaderCircle, RotateCw } from "lucide-react";
import type { ComponentType, SVGProps } from "react";

import { Badge } from "@easytrim-editor/ui/badge";
import { AppleIcon, GithubIcon, LinuxIcon, WindowsIcon } from "@easytrim-editor/ui/brand-icons";
import { Button } from "@easytrim-editor/ui/button";
import { cn } from "@easytrim-editor/ui/class-names";
import { formatDateOnly } from "@easytrim-editor/ui/date-time";

import { FFMPEG_DOWNLOAD_URL, LATEST_RELEASE_URL, RELEASES_URL } from "../consts/links.consts";
import { type GithubData, useGithubData } from "../hooks/useGithubData";
import { useVisitorPlatform } from "../hooks/useVisitorPlatform";
import { fetchLatestRelease, type LatestRelease } from "../lib/github-api.utils";
import { getPlatformInstallers, type Installer } from "../lib/installers.utils";
import {
  type Architecture,
  type DesktopPlatform,
  desktopPlatforms,
  isDesktopPlatform,
  platformNames,
  type VisitorPlatform,
} from "../lib/platform.utils";

const platformIcons: Record<DesktopPlatform, ComponentType<SVGProps<SVGSVGElement>>> = {
  linux: LinuxIcon,
  macos: AppleIcon,
  windows: WindowsIcon,
};

const sizeFormat = new Intl.NumberFormat("en", {
  maximumFractionDigits: 1,
  style: "unit",
  unit: "megabyte",
});

const callToActionClassName = "h-11 gap-2 px-5 text-base";
const inlineLinkClassName =
  "rounded-sm text-foreground underline underline-offset-4 outline-none hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50";

function formatSize(installer: Installer) {
  return sizeFormat.format(installer.size / 1_000_000);
}

type ReleaseProps = { state: GithubData<LatestRelease> };
type VisitorProps = { architecture: Architecture | undefined; platform: VisitorPlatform };

/**
 * Installers from the latest GitHub release, read live so a new release needs no redeploy. The
 * visitor's platform is recommended first; the others stay listed, and only installers actually
 * attached to the release are offered.
 */
function LandingDownloads() {
  const { architecture, platform } = useVisitorPlatform();
  const { retry, state } = useGithubData(fetchLatestRelease);
  const detected = isDesktopPlatform(platform) ? platform : undefined;
  const platforms = detected
    ? [detected, ...desktopPlatforms.filter((other) => other !== detected)]
    : desktopPlatforms;

  return (
    <section
      aria-labelledby="downloads-title"
      className="scroll-mt-16 px-4 pb-20 sm:px-6 sm:pb-28"
      id="downloads"
    >
      <div className="mx-auto max-w-4xl">
        <div className="amber-edge relative isolate overflow-hidden rounded-2xl px-6 py-14 text-center sm:px-12 sm:py-16">
          <div aria-hidden="true" className="hero-glow absolute inset-0 -z-10 opacity-60" />
          <img
            alt=""
            className="mx-auto size-14"
            height={56}
            loading="lazy"
            src={`${import.meta.env.BASE_URL}logo-symbol.svg`}
            width={56}
          />
          <p className="mt-6 text-sm font-semibold tracking-widest text-primary uppercase">
            Download
          </p>
          <h2
            className="mt-3 text-3xl font-bold tracking-tight text-balance sm:text-4xl"
            id="downloads-title"
          >
            Ready for your next clip?
          </h2>
          <ReleaseSummary state={state} />

          <div aria-live="polite" className="mt-8 flex flex-col items-center gap-3">
            <Recommendation
              architecture={architecture}
              platform={platform}
              retry={retry}
              state={state}
            />
          </div>

          <p className="mx-auto mt-8 max-w-md text-xs leading-relaxed text-muted-foreground">
            EasyTrim uses the FFmpeg and FFprobe already on your system and does not bundle them.{" "}
            <a className={inlineLinkClassName} href={FFMPEG_DOWNLOAD_URL}>
              Get FFmpeg
            </a>
          </p>
        </div>

        {state.status !== "error" && (
          <ul aria-label="Installers by platform" className="mt-6 grid gap-4 md:grid-cols-3">
            {platforms.map((option) => (
              <PlatformInstallers
                architecture={architecture}
                detected={option === detected}
                key={option}
                platform={option}
                state={state}
              />
            ))}
          </ul>
        )}

        <div className="mt-8 flex justify-center">
          <Button asChild size="lg" variant="ghost">
            <a href={RELEASES_URL}>
              <GithubIcon />
              All releases
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
}

function ReleaseSummary({ state }: ReleaseProps) {
  if (state.status === "loading") {
    return <p className="mt-4 text-muted-foreground">Checking GitHub for the latest release…</p>;
  }
  if (state.status === "error") {
    return (
      <p className="mt-4 text-muted-foreground">
        The latest release details could not be loaded from GitHub right now.
      </p>
    );
  }

  const { publishedAt, url, version } = state.data;
  const published = publishedAt ? Date.parse(publishedAt) : Number.NaN;
  return (
    <p className="mt-4 text-muted-foreground">
      Latest version <span className="font-medium text-foreground">{version}</span>
      {Number.isFinite(published) && (
        <>
          , released <time dateTime={publishedAt}>{formatDateOnly(published, "en", "")}</time>
        </>
      )}
      {" · "}
      <a className={inlineLinkClassName} href={url}>
        Release notes
      </a>
    </p>
  );
}

function Recommendation({
  architecture,
  platform,
  retry,
  state,
}: ReleaseProps & VisitorProps & { retry: () => void }) {
  if (state.status === "loading") {
    return (
      <Button className={callToActionClassName} disabled size="lg">
        <LoaderCircle aria-hidden="true" className="size-5 motion-safe:animate-spin" />
        Finding your installer…
      </Button>
    );
  }

  if (state.status === "error") {
    return (
      <div className="flex flex-col items-center gap-3 sm:flex-row">
        <Button asChild className={callToActionClassName} size="lg">
          <a href={LATEST_RELEASE_URL}>
            <ExternalLink aria-hidden="true" className="size-5" />
            Open the latest release
          </a>
        </Button>
        <Button className={callToActionClassName} onClick={retry} size="lg" variant="ghost">
          <RotateCw aria-hidden="true" className="size-5" />
          Try again
        </Button>
      </div>
    );
  }

  if (!isDesktopPlatform(platform)) {
    return (
      <p className="max-w-md text-sm text-muted-foreground">
        {platform === "mobile"
          ? "EasyTrim Editor is a desktop app. Open this page on your computer to download it."
          : "Choose the installer for your computer below."}
      </p>
    );
  }

  const name = platformNames[platform];
  const installers = getPlatformInstallers(state.data.installers, platform, architecture);
  const [recommended] = installers;
  if (!recommended) {
    return (
      <p className="max-w-md text-sm text-muted-foreground">
        {state.data.version} has no {name} installer yet. Installers for other platforms are listed
        below.
      </p>
    );
  }

  // Without client hints a Mac's processor is unknown, so point Intel owners to their build.
  const asksForMacProcessor =
    platform === "macos" &&
    !architecture &&
    installers.some((installer) => installer.architecture === "x64") &&
    installers.some((installer) => installer.architecture === "arm64");

  return (
    <>
      <Button asChild className={callToActionClassName} size="lg">
        <a aria-describedby="recommended-installer" download href={recommended.url}>
          <Download aria-hidden="true" className="size-5" />
          Download for {name}
        </a>
      </Button>
      <p className="text-xs text-muted-foreground" id="recommended-installer">
        {recommended.label} · {recommended.extension} · {formatSize(recommended)}
      </p>
      {asksForMacProcessor && (
        <p className="max-w-sm text-xs text-muted-foreground">
          On a Mac with an Intel processor? Choose Intel below. About This Mac in the Apple menu
          shows which one you have.
        </p>
      )}
    </>
  );
}

function PlatformInstallers({
  architecture,
  detected,
  platform,
  state,
}: ReleaseProps &
  Pick<VisitorProps, "architecture"> & { detected: boolean; platform: DesktopPlatform }) {
  const Icon = platformIcons[platform];
  const name = platformNames[platform];
  const installers =
    state.status === "ready"
      ? getPlatformInstallers(state.data.installers, platform, architecture)
      : [];

  return (
    <li className={cn("rounded-xl border bg-card p-5", detected && "amber-edge")}>
      <div className="flex items-center gap-3">
        <Icon className="size-5" />
        <h3 className="font-semibold">{name}</h3>
        {detected && (
          <Badge className="ml-auto" variant="secondary">
            Your system
          </Badge>
        )}
      </div>

      {state.status === "loading" ? (
        <div aria-hidden="true" className="mt-4 grid gap-2">
          <div className="h-13 rounded-lg bg-muted/60 motion-safe:animate-pulse" />
          <div className="h-13 rounded-lg bg-muted/60 motion-safe:animate-pulse" />
        </div>
      ) : installers.length > 0 ? (
        <ul className="mt-4 grid gap-2">
          {installers.map((installer) => (
            <li key={installer.url}>
              <a
                aria-label={`Download ${name} ${installer.label}, ${installer.extension}, ${formatSize(installer)}`}
                className="group flex items-center gap-3 rounded-lg border bg-background/40 px-3 py-2 transition-colors outline-none hover:border-primary/40 hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50"
                download
                href={installer.url}
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{installer.label}</span>
                  <span className="block text-xs text-muted-foreground">
                    {installer.extension} · {formatSize(installer)}
                  </span>
                </span>
                <Download
                  aria-hidden="true"
                  className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary"
                />
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">No installer in this release yet.</p>
      )}
    </li>
  );
}

export { LandingDownloads };

import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  LATEST_RELEASE_URL,
  RELEASE_DOWNLOAD_URL_PREFIX,
  RELEASES_URL,
} from "../../consts/links.consts";
import {
  allPlatformsRelease,
  resetVisitor,
  stubGithub,
  stubVisitor,
  windowsOnlyRelease,
} from "../../test/github.fixtures";
import { LandingDownloads } from "../LandingDownloads";

const download = (fileName: string) => `${RELEASE_DOWNLOAD_URL_PREFIX}v1.15.0/${fileName}`;

function platformCard(name: string) {
  const list = screen.getByRole("list", { name: "Installers by platform" });
  return within(list).getByRole("heading", { name }).closest("li")!;
}

/** Every link that starts a download rather than opening a page. */
function installerLinks() {
  return screen
    .queryAllByRole("link")
    .filter((link) => link.getAttribute("href")!.startsWith(RELEASE_DOWNLOAD_URL_PREFIX));
}

describe("LandingDownloads", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    resetVisitor();
  });

  it("recommends the Windows installer to Windows visitors and lists the alternatives", async () => {
    stubVisitor("windows");
    stubGithub();
    render(<LandingDownloads />);

    expect(screen.getByRole("button", { name: "Finding your installer…" })).toBeDisabled();

    const recommended = await screen.findByRole("link", { name: "Download for Windows" });
    expect(recommended).toHaveAttribute("href", download("EasyTrim_1.15.0_windows_x64_nsis.exe"));
    expect(recommended).toHaveAccessibleDescription("Installer · .exe · 6.2 MB");

    const windows = platformCard("Windows");
    expect(within(windows).getByText("Your system")).toBeInTheDocument();
    expect(
      within(windows).getByRole("link", { name: "Download Windows MSI package, .msi, 8 MB" }),
    ).toHaveAttribute("href", download("EasyTrim_1.15.0_windows_x64_msi.msi"));
  });

  it("shows the live version and links to its notes and to all releases", async () => {
    stubVisitor("windows");
    stubGithub();
    render(<LandingDownloads />);

    expect(await screen.findByText("v1.15.0")).toBeInTheDocument();
    expect(screen.getByText("Oct 18, 2026")).toHaveAttribute("datetime", "2026-10-18T21:41:48Z");
    expect(screen.getByRole("link", { name: "Release notes" })).toHaveAttribute(
      "href",
      windowsOnlyRelease.html_url,
    );
    expect(screen.getByRole("link", { name: "All releases" })).toHaveAttribute(
      "href",
      RELEASES_URL,
    );
  });

  it("never offers signatures, the update manifest, or platforms the release lacks", async () => {
    stubVisitor("macos");
    stubGithub();
    render(<LandingDownloads />);

    expect(
      await screen.findByText("v1.15.0 has no macOS installer yet.", { exact: false }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Download for/ })).not.toBeInTheDocument();
    expect(
      within(platformCard("macOS")).getByText("No installer in this release yet."),
    ).toBeInTheDocument();
    expect(
      within(platformCard("Linux")).getByText("No installer in this release yet."),
    ).toBeInTheDocument();
    expect(installerLinks().map((link) => link.getAttribute("href"))).toEqual([
      download("EasyTrim_1.15.0_windows_x64_nsis.exe"),
      download("EasyTrim_1.15.0_windows_x64_msi.msi"),
    ]);
  });

  it("lists the visitor's platform first", async () => {
    stubVisitor("linux");
    stubGithub({ release: allPlatformsRelease });
    render(<LandingDownloads />);

    expect(await screen.findByRole("link", { name: "Download for Linux" })).toHaveAttribute(
      "href",
      download("EasyTrim_1.15.0_linux_x64_appimage.AppImage"),
    );
    const list = screen.getByRole("list", { name: "Installers by platform" });
    expect(
      within(list)
        .getAllByRole("heading")
        .map((heading) => heading.textContent),
    ).toEqual(["Linux", "Windows", "macOS"]);
  });

  it("recommends Apple silicon on a Mac and points Intel owners to their build", async () => {
    stubVisitor("macos");
    stubGithub({ release: allPlatformsRelease });
    render(<LandingDownloads />);

    expect(await screen.findByRole("link", { name: "Download for macOS" })).toHaveAttribute(
      "href",
      download("EasyTrim_1.15.0_macos_arm64_dmg.dmg"),
    );
    expect(screen.getByText(/On a Mac with an Intel processor/)).toBeInTheDocument();
  });

  it("recommends the Intel build when the browser reports an Intel Mac", async () => {
    stubVisitor("macos", "x86");
    stubGithub({ release: allPlatformsRelease });
    render(<LandingDownloads />);

    expect(await screen.findByRole("link", { name: "Download for macOS" })).toHaveAttribute(
      "href",
      download("EasyTrim_1.15.0_macos_x64_dmg.dmg"),
    );
    expect(screen.queryByText(/On a Mac with an Intel processor/)).not.toBeInTheDocument();
  });

  it("asks phone visitors to come back on a computer without hiding the installers", async () => {
    stubVisitor("android");
    stubGithub();
    render(<LandingDownloads />);

    expect(await screen.findByText(/Open this page on your computer/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Download for/ })).not.toBeInTheDocument();
    expect(screen.queryByText("Your system")).not.toBeInTheDocument();
    expect(installerLinks()).toHaveLength(2);
  });

  it("falls back to the release page when GitHub cannot be reached, and can try again", async () => {
    stubVisitor("windows");
    const fetchMock = stubGithub({ status: 403 });
    render(<LandingDownloads />);

    expect(await screen.findByRole("link", { name: "Open the latest release" })).toHaveAttribute(
      "href",
      LATEST_RELEASE_URL,
    );
    expect(installerLinks()).toHaveLength(0);
    expect(screen.queryByRole("list", { name: "Installers by platform" })).not.toBeInTheDocument();

    stubGithub();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByRole("link", { name: "Download for Windows" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("treats an unexpected response as unavailable", async () => {
    stubVisitor("windows");
    stubGithub({ release: { message: "Not Found" } });
    render(<LandingDownloads />);

    expect(
      await screen.findByRole("link", { name: "Open the latest release" }),
    ).toBeInTheDocument();
  });

  describe("macOS first launch", () => {
    const command = 'xattr -dr com.apple.quarantine "/Applications/EasyTrim Editor.app"';

    it("explains how to open the unsigned app, with the terminal command", async () => {
      stubVisitor("macos");
      stubGithub({ release: allPlatformsRelease });
      render(<LandingDownloads />);

      await screen.findByRole("link", { name: "Download for macOS" });
      expect(
        screen.getByText("The steps are under macOS below.", { exact: false }),
      ).toBeInTheDocument();

      const help = within(platformCard("macOS")).getByText("Can’t open it on macOS?");
      expect(help.closest("details")).not.toHaveAttribute("open");
      expect(within(platformCard("macOS")).getByText(/Open Anyway/)).toBeInTheDocument();
      expect(within(platformCard("macOS")).getByText(command)).toBeInTheDocument();
    });

    it("copies the command", async () => {
      const writeText = vi.fn(() => Promise.resolve());
      Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
      stubVisitor("macos");
      stubGithub({ release: allPlatformsRelease });
      render(<LandingDownloads />);

      fireEvent.click(await screen.findByRole("button", { name: "Copy the command" }));

      expect(writeText).toHaveBeenCalledWith(command);
      expect(await screen.findByText("Copied")).toBeInTheDocument();
      Reflect.deleteProperty(navigator, "clipboard");
    });

    it("stays quiet when there is no macOS installer to help with", async () => {
      stubVisitor("macos");
      stubGithub();
      render(<LandingDownloads />);

      await screen.findByText("v1.15.0 has no macOS installer yet.", { exact: false });

      expect(screen.queryByText("Can’t open it on macOS?")).not.toBeInTheDocument();
      expect(screen.queryByText(/The steps are under macOS below/)).not.toBeInTheDocument();
    });

    it("is not shown to Windows visitors", async () => {
      stubVisitor("windows");
      stubGithub({ release: allPlatformsRelease });
      render(<LandingDownloads />);

      await screen.findByRole("link", { name: "Download for Windows" });

      expect(screen.queryByText(/The steps are under macOS below/)).not.toBeInTheDocument();
      // The macOS card still carries the help for anyone who picks its installer there.
      expect(within(platformCard("macOS")).getByText(command)).toBeInTheDocument();
    });
  });
});

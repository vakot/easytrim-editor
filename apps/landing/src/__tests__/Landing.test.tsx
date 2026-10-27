import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DOWNLOAD_URL, REPOSITORY_URL } from "../consts/links.consts";
import { Landing } from "../Landing";

describe("Landing", () => {
  it("links every download call to action to the latest release", () => {
    render(<Landing />);

    const downloads = screen.getAllByRole("link", { name: /download/i });

    expect(downloads.length).toBeGreaterThanOrEqual(3);
    for (const link of downloads) expect(link).toHaveAttribute("href", DOWNLOAD_URL);
  });

  it("links to the source repository from the header and the hero", () => {
    render(<Landing />);

    expect(screen.getByRole("link", { name: "View EasyTrim Editor on GitHub" })).toHaveAttribute(
      "href",
      REPOSITORY_URL,
    );
    expect(screen.getByRole("link", { name: "View on GitHub" })).toHaveAttribute(
      "href",
      REPOSITORY_URL,
    );
  });

  it("has one page title and labelled sections for each in-page link", () => {
    render(<Landing />);

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    const navigation = screen.getByRole("navigation", { name: "Sections" });
    for (const link of within(navigation).getAllByRole("link")) {
      const target = document.querySelector(link.getAttribute("href")!);

      expect(target).toHaveAttribute("aria-labelledby");
    }
  });

  it("offers a skip link to the main content", () => {
    render(<Landing />);

    expect(screen.getByRole("link", { name: "Skip to content" })).toHaveAttribute("href", "#main");
    expect(screen.getByRole("main")).toHaveAttribute("id", "main");
  });

  it("loads the hero screenshot first and the others lazily, all sized up front", () => {
    render(<Landing />);

    const [hero, ...rest] = screen
      .getAllByRole("img")
      .filter((image) => image.getAttribute("srcset"));

    expect(hero).toHaveAttribute("loading", "eager");
    expect(hero).toHaveAttribute("fetchpriority", "high");
    expect(rest.length).toBeGreaterThan(0);
    for (const image of [hero!, ...rest]) {
      expect(image).toHaveAccessibleName();
      expect(image).toHaveAttribute("width");
      expect(image).toHaveAttribute("height");
    }
    for (const image of rest) expect(image).toHaveAttribute("loading", "lazy");
  });
});

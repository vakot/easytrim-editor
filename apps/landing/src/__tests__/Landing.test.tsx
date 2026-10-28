import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { KOFI_URL, REPOSITORY_URL } from "../consts/links.consts";
import { Landing } from "../Landing";
import { resetVisitor, stubGithub, stubVisitor } from "../test/github.fixtures";

describe("Landing", () => {
  beforeEach(() => {
    stubVisitor("windows");
    stubGithub();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    resetVisitor();
  });

  it("scrolls to the downloads from the header and the hero", async () => {
    render(<Landing />);

    const header = screen.getByRole("banner");
    expect(within(header).getByRole("link", { name: "Download" })).toHaveAttribute(
      "href",
      "#downloads",
    );
    expect(screen.getByRole("link", { name: "Download EasyTrim" })).toHaveAttribute(
      "href",
      "#downloads",
    );
    expect(document.querySelector("#downloads")).toHaveAttribute(
      "aria-labelledby",
      "downloads-title",
    );
    expect(await screen.findByRole("link", { name: "Download for Windows" })).toBeInTheDocument();
  });

  it("links to the source repository from the header and the hero", async () => {
    render(<Landing />);

    expect(await screen.findByRole("link", { name: "GitHub, 1 star" })).toHaveAttribute(
      "href",
      REPOSITORY_URL,
    );
    expect(screen.getByRole("link", { name: "View on GitHub" })).toHaveAttribute(
      "href",
      REPOSITORY_URL,
    );
  });

  it("offers Ko-fi support from the header and the footer", () => {
    render(<Landing />);

    expect(screen.getByRole("link", { name: "Support EasyTrim Editor on Ko-fi" })).toHaveAttribute(
      "href",
      KOFI_URL,
    );
    const footer = screen.getByRole("navigation", { name: "Footer" });
    expect(within(footer).getByRole("link", { name: "Support on Ko-fi" })).toHaveAttribute(
      "href",
      KOFI_URL,
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

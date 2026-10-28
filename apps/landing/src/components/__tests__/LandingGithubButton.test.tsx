import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { REPOSITORY_URL } from "../../consts/links.consts";
import { stubGithub } from "../../test/github.fixtures";
import { LandingGithubButton } from "../LandingGithubButton";

describe("LandingGithubButton", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the live star count in compact form", async () => {
    stubGithub({ stars: 1_234 });
    render(<LandingGithubButton />);

    expect(await screen.findByRole("link", { name: "GitHub, 1.2K stars" })).toHaveAttribute(
      "href",
      REPOSITORY_URL,
    );
  });

  it("names a single star", async () => {
    stubGithub({ stars: 1 });
    render(<LandingGithubButton />);

    expect(await screen.findByRole("link", { name: "GitHub, 1 star" })).toBeInTheDocument();
  });

  it("keeps the link without a count when GitHub cannot be reached", async () => {
    const fetchMock = stubGithub({ status: 500 });
    render(<LandingGithubButton />);

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(await screen.findByRole("link", { name: "GitHub" })).toHaveAttribute(
      "href",
      REPOSITORY_URL,
    );
  });
});

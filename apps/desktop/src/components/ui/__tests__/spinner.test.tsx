import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { i18n } from "@/i18n/config";

import { Spinner } from "../spinner";

describe("Spinner", () => {
  it("uses a CSS spin animation that respects the reduced-motion preference", () => {
    render(<Spinner />);

    const spinner = screen.getByRole("status", { name: i18n.t("common.status.loading") });
    expect(spinner).toBeVisible();
    expect(spinner).toHaveClass("motion-safe:animate-spin");
  });

  it("allows decorative use without adding a duplicate status announcement", () => {
    render(
      <button aria-label="Analyzing audio" type="button">
        <Spinner aria-hidden="true" />
        Analyzing audio
      </button>,
    );

    expect(screen.getByRole("button", { name: "Analyzing audio" })).toBeVisible();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("allows a consumer to override the localized loading label", () => {
    render(<Spinner aria-label="Preparing preview" />);

    expect(screen.getByRole("status", { name: "Preparing preview" })).toBeVisible();
  });
});

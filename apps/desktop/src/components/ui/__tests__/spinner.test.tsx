import { render, screen } from "@testing-library/react";
import { useReducedMotion } from "motion/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { i18n } from "@/i18n/config";

import { Spinner } from "../spinner";

vi.mock("motion/react", () => ({ useReducedMotion: vi.fn() }));

const mockedUseReducedMotion = vi.mocked(useReducedMotion);

describe("Spinner", () => {
  beforeEach(() => {
    mockedUseReducedMotion.mockReturnValue(true);
  });

  it("keeps the semantic status visible without rotating when reduced motion is requested", () => {
    render(<Spinner />);

    const spinner = screen.getByRole("status", { name: i18n.t("common.status.loading") });
    expect(spinner).toBeVisible();
    expect(spinner).not.toHaveClass("animate-spin");
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

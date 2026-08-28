import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AppErrorBoundary } from "./AppErrorBoundary";

function BrokenChild(): never {
  throw new Error("render failed", { cause: "test cause" });
}

describe("AppErrorBoundary", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders children while the application is healthy", () => {
    render(
      <AppErrorBoundary>
        <p>Application content</p>
      </AppErrorBoundary>,
    );

    expect(screen.getByText("Application content")).toBeInTheDocument();
  });

  it("shows the error page and logs diagnostic details", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    render(
      <AppErrorBoundary>
        <BrokenChild />
      </AppErrorBoundary>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong");
    expect(screen.getByRole("button", { name: "Restart application" })).toBeInTheDocument();
    expect(consoleError).toHaveBeenCalledWith(
      "[app] Unhandled React error",
      expect.objectContaining({
        error: expect.any(Error),
        name: "Error",
        message: "render failed",
        stack: expect.stringContaining("render failed"),
        cause: "test cause",
        componentStack: expect.stringContaining("BrokenChild"),
        timestamp: expect.any(String),
        url: window.location.href,
        userAgent: window.navigator.userAgent,
      }),
    );
  });
});

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import App from "./App";

describe("App", () => {
  it("renders the Easy Cut desktop foundation", () => {
    render(<App />);

    expect(screen.getByRole("heading", { level: 1, name: "Easy Cut" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Desktop foundation ready" }),
    ).toBeInTheDocument();
  });
});

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Highlight } from "../highlight";

describe("Highlight", () => {
  it("highlights every matching substring", () => {
    render(<Highlight query="clip">clip-clip.mp4</Highlight>);

    const matches = screen.getAllByText("clip");
    expect(matches).toHaveLength(2);
    expect(matches.every((match) => match.tagName === "MARK")).toBe(true);
  });

  it("matches without changing the original text casing", () => {
    render(<Highlight query="project">C:/Media/PROJECT/clip.mp4</Highlight>);

    expect(screen.getByText("PROJECT")).toHaveAttribute(
      "class",
      expect.stringContaining("bg-primary"),
    );
  });

  it("returns plain text when the query is empty", () => {
    const { container } = render(<Highlight query="">clip.mp4</Highlight>);

    expect(container.querySelector("mark")).not.toBeInTheDocument();
    expect(screen.getByText("clip.mp4")).toBeInTheDocument();
  });
});

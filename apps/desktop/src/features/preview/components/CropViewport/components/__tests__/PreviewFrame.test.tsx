import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PreviewFrame } from "../PreviewFrame";

describe("PreviewFrame", () => {
  it("expresses the crop-safe contain target through CSS layout values", () => {
    const { container } = render(
      <PreviewFrame aspectRatio={16 / 9} cropEditing transition={{ duration: 0.3 }}>
        <div data-testid="preview-content" />
      </PreviewFrame>,
    );

    const frame = container.querySelector("[data-preview-frame]");
    const previewArea = container.querySelector("[data-preview-area]");

    expect(frame).toHaveAttribute("data-aspect-ratio", String(16 / 9));
    expect(frame).toHaveAttribute("data-crop-editing", "true");
    expect(previewArea).toHaveStyle({
      "--preview-aspect-ratio": String(16 / 9),
      "--preview-crop-width": `min(max(0px, calc(100cqw - 56px)), max(0px, calc(${(16 / 9) * 100}cqh - ${(16 / 9) * 56}px)))`,
      "--preview-normal-width": `min(100cqw, ${(16 / 9) * 100}cqh)`,
    });
    expect(frame).not.toHaveStyle({ width: "400px", height: "225px" });
    expect(container.querySelector("[data-transition-clock]")).not.toBeInTheDocument();
  });
});

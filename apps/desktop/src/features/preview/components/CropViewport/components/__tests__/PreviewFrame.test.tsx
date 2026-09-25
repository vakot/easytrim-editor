import { render } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";

import type { RotationDegrees } from "@/domain/rotation";

import type { PreviewPresentationState } from "../../hooks/usePreviewPresentation";
import { PreviewFrame } from "../PreviewFrame";

function transition(id: number, rotation: RotationDegrees): PreviewPresentationState {
  const state = {
    crop: { x: 0, y: 0, width: 1, height: 1 },
    cropIsOpen: false,
    flipHorizontal: false,
    flipVertical: false,
    rotation,
    rotationAngle: rotation,
  };

  return {
    from: { ...state, rotation: 0, rotationAngle: 0 },
    fromFrame: { width: 800, height: 450 },
    id,
    status: "transitioning",
    to: state,
    toFrame: { width: 450, height: 800 },
  };
}

describe("PreviewFrame", () => {
  it("replaces its completion clock when a transition is interrupted", () => {
    const props = {
      aspectRatio: 16 / 9,
      children: null,
      cropEditing: false,
      frameRef: createRef<HTMLDivElement>(),
      onTransitionComplete: vi.fn(),
      presentation: transition(1, 90),
      transition: { duration: 0.3 },
    };

    const { container, rerender } = render(<PreviewFrame {...props} />);
    const firstClock = container.querySelector("[data-transition-clock]");

    rerender(<PreviewFrame {...props} presentation={transition(2, 180)} />);

    expect(container.querySelector("[data-transition-clock]")).not.toBe(firstClock);
  });
});

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { AudioTrackProcessing } from "@/domain/audio-processing";

import { AudioTrackEffectsDraftProvider } from "../AudioTrackEffectsDialog/components/AudioTrackEffectsDraftProvider";

import type { AudioTrackEffectDescriptor } from "./audio-track-effects.registry";
import { AudioTrackEffectsLibrary } from "./AudioTrackEffectsLibrary";

function FirstEffectPage() {
  return <p>First effect controls</p>;
}

function SecondEffectPage() {
  return <p>Second effect controls</p>;
}

const effects: readonly AudioTrackEffectDescriptor[] = [
  {
    id: "first",
    stage: "cleanup",
    label: () => "First effect",
    Page: FirstEffectPage,
    isEnabled: () => true,
    isDirty: () => false,
  },
  {
    id: "second",
    stage: "dynamics",
    label: () => "Second effect",
    Page: SecondEffectPage,
    isEnabled: () => false,
    isDirty: () => false,
  },
];

describe("AudioTrackEffectsLibrary", () => {
  it("uses registry order and renders arbitrary effect pages without shell branches", () => {
    const initialProcessing = { gainDb: 0, firstEnabled: true } as AudioTrackProcessing;
    render(
      <AudioTrackEffectsDraftProvider initialProcessing={initialProcessing}>
        <AudioTrackEffectsLibrary effects={effects} streamIndex={2} />
      </AudioTrackEffectsDraftProvider>,
    );

    const navigation = screen.getByRole("navigation");
    const links = within(navigation).getAllByRole("button");
    expect(links.map((link) => link.textContent?.trim())).toEqual([
      "First effect",
      "Second effect",
    ]);
    expect(links[0]).toHaveAttribute("aria-current", "page");
    expect(links[0]?.querySelector("svg.lucide-check")).toBeInTheDocument();
    expect(screen.getByText("First effect controls")).toBeVisible();
    expect(screen.getByText("Second effect controls").parentElement).not.toBeVisible();

    fireEvent.click(links[1]!);
    expect(links[1]).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("Second effect controls")).toBeVisible();
  });
});

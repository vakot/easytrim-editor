import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import type { AudioTrackProcessing } from "@/domain/audio-processing";

import { AudioTrackEffectsDraftProvider } from "../../AudioTrackEffectsDialog/components/AudioTrackEffectsDraftProvider";
import { AudioTrackEffectsLibrary } from "../AudioTrackEffectsLibrary";
import type { AudioTrackEffectDescriptor } from "../consts/audio-track-effects";

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
    isDirty: () => true,
  },
];

describe("AudioTrackEffectsLibrary", () => {
  it("uses registry order, tab semantics, and keyboard page switching without shell branches", async () => {
    const user = userEvent.setup();
    const initialProcessing = { gainDb: 0, firstEnabled: true } as AudioTrackProcessing;
    render(
      <AudioTrackEffectsDraftProvider initialProcessing={initialProcessing}>
        <AudioTrackEffectsLibrary effects={effects} streamIndex={2} />
      </AudioTrackEffectsDraftProvider>,
    );

    const tabs = within(screen.getByRole("tablist")).getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent?.trim())).toEqual(["First effect", "Second effect"]);
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    expect(tabs[0]?.querySelector("svg.lucide-check")).toBeInTheDocument();
    expect(tabs[1]?.querySelector(".rounded-full")).toBeInTheDocument();
    expect(screen.getByText("First effect controls")).toBeVisible();
    expect(screen.getByText("Second effect controls").parentElement).not.toBeVisible();

    tabs[0]?.focus();
    await user.keyboard("{ArrowDown}");
    expect(tabs[1]).toHaveFocus();
    expect(tabs[1]).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Second effect controls")).toBeVisible();
    expect(screen.getByText("First effect controls").parentElement).not.toBeVisible();
  });
});

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

  it("groups tabs by canonical stage order and preserves registry order within each stage", async () => {
    const user = userEvent.setup();
    const stageEffects: readonly AudioTrackEffectDescriptor[] = [
      { ...effects[1]!, id: "dynamics", label: () => "Dynamics effect" },
      { ...effects[0]!, id: "cleanup-first", label: () => "Cleanup first" },
      {
        ...effects[1]!,
        id: "level",
        label: () => "Level effect",
        stage: "levelPolicy",
      },
      { ...effects[0]!, id: "cleanup-second", label: () => "Cleanup second" },
    ];

    render(
      <AudioTrackEffectsDraftProvider initialProcessing={{ gainDb: 0 }}>
        <AudioTrackEffectsLibrary effects={stageEffects} streamIndex={2} />
      </AudioTrackEffectsDraftProvider>,
    );

    const tablistElement = screen.getByRole("tablist");
    const tablist = within(tablistElement);
    const groups = Array.from(
      tablistElement.querySelectorAll<HTMLElement>('[data-slot="audio-track-effects-stage"]'),
    );

    expect(groups.map((group) => group.dataset.stage)).toEqual([
      "cleanup",
      "dynamics",
      "levelPolicy",
    ]);
    expect(
      groups.map(
        (group) =>
          group.querySelector('[data-slot="audio-track-effects-stage-label"]')?.textContent,
      ),
    ).toEqual(["Cleanup", "Dynamics", "Level"]);

    const tabs = tablist.getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent?.trim())).toEqual([
      "Cleanup first",
      "Cleanup second",
      "Dynamics effect",
      "Level effect",
    ]);
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    tabs[1]?.focus();
    await user.keyboard("{ArrowDown}");
    expect(tabs[2]).toHaveFocus();
    expect(tabs[2]).toHaveAttribute("aria-selected", "true");
  });
});

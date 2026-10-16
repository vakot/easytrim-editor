import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";

vi.mock("@/lib/tauri/media", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tauri/media")>()),
  analyzeAudioLoudness: vi.fn(async () => []),
}));

import { sourceReady, sourceSelected } from "@/app/store/actions/source-actions";
import { audioTrackFiltersApplied } from "@/app/store/slices/audio-slice";
import { createAppStore } from "@/app/store/store";
import { firstSource, mediaWithAudio } from "@/test/source.fixtures";

import { AudioTrackFiltersDialog, AudioTrackFiltersDialogTrigger } from "..";

function renderDialog() {
  const store = createAppStore();
  store.dispatch(sourceSelected({ loadToken: 1, source: firstSource }));
  store.dispatch(sourceReady({ loadToken: 1, media: mediaWithAudio(firstSource.sourcePath) }));

  render(
    <Provider store={store}>
      <TooltipProvider>
        <AudioTrackFiltersDialog streamIndex={2}>
          <AudioTrackFiltersDialogTrigger asChild>
            <button type="button">Open filters</button>
          </AudioTrackFiltersDialogTrigger>
        </AudioTrackFiltersDialog>
      </TooltipProvider>
    </Provider>,
  );

  const committedFilters = () => store.getState().audio.tracks[0]!.processing.filters;
  return { committedFilters, store };
}

async function addFilter(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(screen.getByRole("button", { name: "Add filter" }));
  await user.click(await screen.findByRole("menuitem", { name }));
}

function tabNames() {
  return within(screen.getByRole("tablist", { name: "Filter chain" }))
    .getAllByRole("tab")
    .map((tab) => tab.textContent);
}

describe("AudioTrackFiltersDialog", () => {
  it("edits a draft and commits the complete ordered chain atomically on Apply", async () => {
    const user = userEvent.setup();
    const { committedFilters } = renderDialog();
    await user.click(screen.getByRole("button", { name: "Open filters" }));

    expect(await screen.findByText("No filters yet. Add one to process this track.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();

    await addFilter(user, "Gain");
    await addFilter(user, "Limiter");
    await addFilter(user, "Gain");
    expect(tabNames()).toEqual(["Gain 1", "Limiter", "Gain 2"]);
    expect(screen.getByRole("tab", { name: "Gain 2" })).toHaveAttribute("aria-selected", "true");

    await user.click(screen.getByRole("button", { name: "Move filter up" }));
    expect(tabNames()).toEqual(["Gain 1", "Gain 2", "Limiter"]);

    await user.click(screen.getByRole("tab", { name: "Gain 1" }));
    const gainInput = screen.getByRole("textbox", { name: "Gain" });
    await user.clear(gainInput);
    await user.type(gainInput, "6");
    expect(committedFilters()).toEqual([]);

    await user.click(screen.getByRole("button", { name: "Apply" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const applied = committedFilters();
    expect(applied.map(({ type }) => type)).toEqual(["gain", "gain", "limiter"]);
    expect(applied[0]).toMatchObject({ gainDb: 6 });
    expect(applied[2]).toMatchObject({ attackMs: 5, ceilingDb: -1, releaseMs: 50 });

    // Reopening starts from the committed chain; unchanged instances keep their identity.
    await user.click(screen.getByRole("button", { name: "Open filters" }));
    await user.click(await screen.findByRole("tab", { name: "Limiter" }));
    await user.click(screen.getByRole("button", { name: "Remove filter" }));
    await user.click(screen.getByRole("button", { name: "Apply" }));
    expect(committedFilters()).toEqual(applied.slice(0, 2));
  });

  it("discards every draft change on Cancel", async () => {
    const user = userEvent.setup();
    const { committedFilters, store } = renderDialog();
    store.dispatch(
      audioTrackFiltersApplied({
        filters: [{ enabled: true, cutoffHz: 80, id: "hp", type: "highPass" }],
        streamIndex: 2,
      }),
    );
    await user.click(screen.getByRole("button", { name: "Open filters" }));
    await addFilter(user, "Noise reduction");
    await user.click(screen.getByRole("tab", { name: "High-pass filter" }));
    await user.click(screen.getByRole("button", { name: "Remove filter" }));
    expect(tabNames()).toEqual(["Noise reduction"]);

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(committedFilters()).toEqual([
      { enabled: true, cutoffHz: 80, id: "hp", type: "highPass" },
    ]);
    await user.click(screen.getByRole("button", { name: "Open filters" }));
    expect(await screen.findByRole("tab", { name: "High-pass filter" })).toBeVisible();
    expect(tabNames()).toEqual(["High-pass filter"]);
  });

  it("blocks Apply while a parameter is invalid and never commits it", async () => {
    const user = userEvent.setup();
    const { committedFilters } = renderDialog();
    await user.click(screen.getByRole("button", { name: "Open filters" }));
    await addFilter(user, "High-pass filter");

    const cutoff = screen.getByRole("textbox", { name: "Cutoff frequency" });
    await user.clear(cutoff);
    await user.type(cutoff, "5");

    expect(cutoff).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Enter a value from 10 to 20000 Hz")).toBeVisible();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Fix the highlighted values before applying",
    );
    expect(screen.getByRole("img", { name: "This filter has an invalid value" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();
    expect(committedFilters()).toEqual([]);

    await user.type(cutoff, "0");
    expect(screen.getByRole("button", { name: "Apply" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Apply" }));
    expect(committedFilters()).toEqual([
      expect.objectContaining({ enabled: true, cutoffHz: 50, type: "highPass" }),
    ]);
  });

  it("uses presets only to fill explicit parameters", async () => {
    const user = userEvent.setup();
    const { committedFilters } = renderDialog();
    await user.click(screen.getByRole("button", { name: "Open filters" }));
    await addFilter(user, "Noise reduction");

    const preset = screen.getByRole("combobox", { name: "Preset" });
    expect(preset).toHaveTextContent("Medium");
    await user.click(preset);
    await user.click(await screen.findByRole("option", { name: "Strong" }));
    expect(screen.getByRole("textbox", { name: "Reduction amount" })).toHaveValue("20");
    expect(screen.getByRole("textbox", { name: "Noise floor" })).toHaveValue("-30");

    const reduction = screen.getByRole("textbox", { name: "Reduction amount" });
    await user.clear(reduction);
    await user.type(reduction, "21");
    expect(screen.getByRole("combobox", { name: "Preset" })).toHaveTextContent("Custom");

    await user.click(screen.getByRole("button", { name: "Apply" }));
    const [filter] = committedFilters();
    expect(filter).toEqual({
      enabled: true,
      id: expect.any(String),
      noiseFloorDb: -30,
      reductionDb: 21,
      type: "noiseReduction",
    });
  });

  it("disables a filter in place and commits its enabled state with the chain", async () => {
    const user = userEvent.setup();
    const { committedFilters } = renderDialog();
    await user.click(screen.getByRole("button", { name: "Open filters" }));
    await addFilter(user, "Gain");
    await addFilter(user, "Limiter");

    await user.click(screen.getByRole("tab", { name: "Gain" }));
    const toggle = screen.getByRole("switch", { name: "Filter enabled" });
    expect(toggle).toBeChecked();
    await user.click(toggle);

    expect(toggle).not.toBeChecked();
    expect(
      within(screen.getByRole("tab", { name: /^Gain/ })).getByRole("img", {
        name: "This filter is disabled and does not process audio",
      }),
    ).toBeVisible();
    expect(tabNames()).toEqual(["Gain", "Limiter"]);
    expect(committedFilters()).toEqual([]);

    await user.click(screen.getByRole("button", { name: "Apply" }));
    expect(committedFilters().map(({ enabled, type }) => ({ enabled, type }))).toEqual([
      { enabled: false, type: "gain" },
      { enabled: true, type: "limiter" },
    ]);

    await user.click(screen.getByRole("button", { name: "Open filters" }));
    await user.click(await screen.findByRole("tab", { name: /^Gain/ }));
    expect(screen.getByRole("switch", { name: "Filter enabled" })).not.toBeChecked();
  });

  it("disables actions that do not apply to the current selection", async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.click(screen.getByRole("button", { name: "Open filters" }));

    expect(screen.getByRole("button", { name: "Move filter up" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move filter down" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Remove filter" })).toBeDisabled();

    await addFilter(user, "Loudness normalization");
    expect(screen.getByRole("button", { name: "Move filter up" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move filter down" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Remove filter" })).toBeEnabled();

    await addFilter(user, "Loudness normalization");
    expect(tabNames()).toEqual(["Loudness normalization 1", "Loudness normalization 2"]);
    expect(screen.getByRole("button", { name: "Move filter up" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Move filter down" })).toBeDisabled();
  });
});

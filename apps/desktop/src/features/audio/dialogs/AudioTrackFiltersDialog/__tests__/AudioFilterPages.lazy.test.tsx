import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";

// Each factory runs when its module is first imported, so these lists are the load history.
const loads = vi.hoisted(() => ({
  content: 0,
  gate: { open: () => undefined as void, promise: undefined as unknown as Promise<void> },
  pages: [] as string[],
}));

loads.gate.promise = new Promise<void>((resolve) => {
  loads.gate.open = resolve;
});

vi.mock("@/lib/tauri/media", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tauri/media")>()),
  analyzeAudioLoudness: vi.fn(async () => []),
}));
vi.mock("../AudioTrackFiltersDialogContent", async (importOriginal) => {
  loads.content += 1;
  return importOriginal();
});
vi.mock("../pages/GainFilterPage", async () => {
  await loads.gate.promise;
  loads.pages.push("gain");
  return { GainFilterPage: () => <div data-testid="page-gain" /> };
});
vi.mock("../pages/HighPassFilterPage", () => {
  loads.pages.push("highPass");
  return { HighPassFilterPage: () => <div data-testid="page-highPass" /> };
});
vi.mock("../pages/LimiterFilterPage", () => {
  loads.pages.push("limiter");
  return { LimiterFilterPage: () => <div data-testid="page-limiter" /> };
});
vi.mock("../pages/LoudnessNormalizationFilterPage", () => {
  loads.pages.push("loudnessNormalization");
  return {
    LoudnessNormalizationFilterPage: () => <div data-testid="page-loudnessNormalization" />,
  };
});
vi.mock("../pages/NoiseReductionFilterPage", () => {
  loads.pages.push("noiseReduction");
  return { NoiseReductionFilterPage: () => <div data-testid="page-noiseReduction" /> };
});

import { sourceReady, sourceSelected } from "@/app/store/actions/source-actions";
import { audioTrackFiltersApplied } from "@/app/store/slices/audio-slice";
import { createAppStore } from "@/app/store/store";
import type { AudioFilter } from "@/domain/audio-processing";
import { firstSource, mediaWithAudio } from "@/test/source.fixtures";

import { AudioPlaybackProvider } from "../../../AudioPlaybackProvider";
import { AudioTrackFiltersDialog, AudioTrackFiltersDialogTrigger } from "..";

const limiter = (id: string): AudioFilter => ({
  attackMs: 5,
  ceilingDb: -1,
  enabled: true,
  id,
  releaseMs: 50,
  type: "limiter",
});

function renderDialog(filters: AudioFilter[]) {
  const store = createAppStore();
  store.dispatch(sourceSelected({ loadToken: 1, source: firstSource }));
  store.dispatch(sourceReady({ loadToken: 1, media: mediaWithAudio(firstSource.sourcePath) }));
  store.dispatch(audioTrackFiltersApplied({ filters, streamIndex: 2 }));

  render(
    <Provider store={store}>
      <AudioPlaybackProvider>
        <TooltipProvider>
          <AudioTrackFiltersDialog streamIndex={2}>
            <AudioTrackFiltersDialogTrigger asChild>
              <button type="button">Open filters</button>
            </AudioTrackFiltersDialogTrigger>
          </AudioTrackFiltersDialog>
        </TooltipProvider>
      </AudioPlaybackProvider>
    </Provider>,
  );

  return { store };
}

const tabNames = () =>
  within(screen.getByRole("tablist", { name: "Filter chain" }))
    .getAllByRole("tab")
    .map((tab) => tab.textContent);

// The modules are cached for the whole file, so each test uses filter types the earlier ones
// did not load, in this order.
describe("lazily loaded filter pages", () => {
  beforeAll(() => {
    // Reordering the chain list asks the document for its animations, which jsdom lacks, as it does for elements.
    for (const target of [document, Element.prototype]) {
      Object.defineProperty(target, "getAnimations", { configurable: true, value: () => [] });
    }
  });

  it("loads the dialog and the page it opens on together, on intent, and nothing else", async () => {
    const user = userEvent.setup();
    renderDialog([
      {
        enabled: true,
        id: "nr",
        noiseFloorDb: -35,
        reductionDb: 12,
        type: "noiseReduction",
      },
      limiter("later"),
    ]);
    expect(loads.content).toBe(0);
    expect(loads.pages).toEqual([]);

    await user.hover(screen.getByRole("button", { name: "Open filters" }));
    await vi.waitFor(() => expect(loads.pages).toEqual(["noiseReduction"]));
    expect(loads.content).toBe(1);

    // Opening shows the page that was already loaded; the other type still waits.
    await user.click(screen.getByRole("button", { name: "Open filters" }));
    expect(await screen.findByTestId("page-noiseReduction")).toBeInTheDocument();
    expect(loads.pages).toEqual(["noiseReduction"]);
  });

  it("loads a page when its type is first shown and reuses it for every later visit and instance", async () => {
    const user = userEvent.setup();
    renderDialog([
      limiter("first"),
      limiter("second"),
      { cutoffHz: 80, enabled: true, id: "hp", type: "highPass" },
    ]);
    await user.click(screen.getByRole("button", { name: "Open filters" }));

    // Only the selected instance's page is mounted.
    expect(await screen.findByTestId("page-limiter")).toBeInTheDocument();
    expect(screen.queryByTestId("page-highPass")).not.toBeInTheDocument();
    expect(loads.pages).toEqual(["noiseReduction", "limiter"]);

    await user.click(screen.getByRole("tab", { name: "High-pass filter" }));
    expect(await screen.findByTestId("page-highPass")).toBeInTheDocument();
    expect(screen.queryByTestId("page-limiter")).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Limiter 2" }));
    expect(await screen.findByTestId("page-limiter")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Limiter 1" }));
    expect(await screen.findByTestId("page-limiter")).toBeInTheDocument();
    expect(screen.queryByTestId("page-highPass")).not.toBeInTheDocument();
    expect(loads.pages).toEqual(["noiseReduction", "limiter", "highPass"]);
  });

  it("waits for a page inside the content area while the draft, list, and preview keep working", async () => {
    const user = userEvent.setup();
    const { store } = renderDialog([
      limiter("only-limiter"),
      { enabled: true, gainDb: 3, id: "gain", type: "gain" },
    ]);

    await user.click(screen.getByRole("button", { name: "Open filters" }));
    expect(await screen.findByTestId("page-limiter")).toBeInTheDocument();

    // Gain's module is held back.
    await user.click(screen.getByRole("tab", { name: "Gain" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog.querySelector("[aria-busy='true']")).toBeInTheDocument();
    expect(screen.queryByTestId("page-limiter")).not.toBeInTheDocument();
    expect(loads.pages).not.toContain("gain");

    // The rest of the dialog is not blocked: edit the chain while the page loads.
    expect(screen.getByRole("tab", { name: "Gain" })).toHaveAttribute("aria-selected", "true");
    await user.click(screen.getByRole("button", { name: "Move filter up" }));
    expect(tabNames()).toEqual(["Gain", "Limiter"]);
    expect(screen.getByRole("button", { name: "Apply" })).toBeEnabled();
    await vi.waitFor(() =>
      expect(store.getState().audio.filterPreview?.filters.map(({ type }) => type)).toEqual([
        "gain",
        "limiter",
      ]),
    );

    loads.gate.open();
    expect(await screen.findByTestId("page-gain")).toBeInTheDocument();
    expect(dialog.querySelector("[aria-busy='true']")).not.toBeInTheDocument();
    // The draft survived the wait unchanged.
    expect(tabNames()).toEqual(["Gain", "Limiter"]);
    expect(screen.getByRole("button", { name: "Apply" })).toBeEnabled();
  });
});

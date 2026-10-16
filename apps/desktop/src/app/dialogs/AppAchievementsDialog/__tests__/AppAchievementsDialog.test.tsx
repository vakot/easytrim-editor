import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAchievementRecords: vi.fn(),
  getUsageStatistics: vi.fn(),
  markAchievementsViewed: vi.fn(),
}));

vi.mock("@/lib/tauri/achievements", () => ({
  getAchievementRecords: mocks.getAchievementRecords,
  markAchievementsViewed: mocks.markAchievementsViewed,
  recordSplashMessageDiscovery: vi.fn(),
  unlockAchievements: vi.fn(),
}));
vi.mock("@/lib/tauri/statistics", () => ({ getUsageStatistics: mocks.getUsageStatistics }));

import { useAchievementsDialog } from "@/app/hooks/useAppDialog";
import { AppDialogsProvider } from "@/app/providers/AppDialogsProvider";
import { achievementRecordsUpdated } from "@/app/store/slices/achievements-slice";
import { createAppStore } from "@/app/store/store";
import { i18n } from "@/i18n/config";
import { emptyAchievementRecords } from "@/test/achievement-records.fixtures";
import { emptyUsageStatistics } from "@/test/usage-statistics.fixtures";

import { AppAchievementsDialog } from "../AppAchievementsDialog";

function OpenAchievementsButton() {
  const { openDialog } = useAchievementsDialog();
  return (
    <button onClick={openDialog} type="button">
      Open
    </button>
  );
}

function renderDialog() {
  const store = createAppStore({
    getItem: async () => null,
    setItem: async () => undefined,
    removeItem: async () => undefined,
  });

  render(
    <Provider store={store}>
      <AppDialogsProvider>
        <OpenAchievementsButton />
        <AppAchievementsDialog />
      </AppDialogsProvider>
    </Provider>,
  );
  return store;
}

async function openDialog() {
  await userEvent.click(screen.getByRole("button", { name: "Open" }));
  return screen.findByRole("dialog", { name: "Achievements" });
}

function achievement(dialog: HTMLElement, title: string) {
  const item = within(dialog).getByText(title).closest("[data-slot='item']");
  if (!(item instanceof HTMLElement)) throw new Error(`Achievement ${title} is not rendered.`);
  return item;
}

const unlockedAt = Date.UTC(2026, 9, 12, 12);

describe("AppAchievementsDialog", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
    vi.resetAllMocks();
  });

  function cards(dialog: HTMLElement) {
    return dialog.querySelectorAll("[data-slot='item'][role='listitem']");
  }

  it("shows one card per series with every tier locked", async () => {
    mocks.getAchievementRecords.mockResolvedValue(emptyAchievementRecords);
    mocks.getUsageStatistics.mockResolvedValue(emptyUsageStatistics);
    renderDialog();

    const dialog = await openDialog();

    expect(await within(dialog).findByText("0 of 22 unlocked")).toBeVisible();
    expect(
      within(dialog).getByRole("progressbar", { name: "Collection progress" }),
    ).toHaveAttribute("aria-valuenow", "0");
    expect(cards(dialog)).toHaveLength(8);
    const mastery = achievement(dialog, "Export Mastery");
    expect(mastery).toHaveAttribute("data-state", "locked");
    expect(within(mastery).getByText("Locked")).toBeVisible();
    expect(within(mastery).getByText("Next: Bronze")).toBeVisible();
    expect(within(mastery).getByRole("listitem", { name: "Gold, 100, locked" })).toBeVisible();
    expect(
      within(dialog).getByText(
        "Achievements are tracked locally on this device and are never shared or sent anywhere",
      ),
    ).toBeVisible();
  });

  it("shows the highest tier, progress toward the next tier, and every tier's status", async () => {
    mocks.getAchievementRecords.mockResolvedValue({
      ...emptyAchievementRecords,
      unlockedAchievements: {
        "export-mastery-bronze": Date.UTC(2026, 0, 15, 12),
        "export-mastery-silver": unlockedAt,
        "gif-creator-bronze": unlockedAt,
      },
      viewedAtMillis: Date.UTC(2026, 11, 1, 12),
    });
    mocks.getUsageStatistics.mockResolvedValue({
      ...emptyUsageStatistics,
      gifExports: 2,
      optimizedExports: 35,
    });
    renderDialog();

    const dialog = await openDialog();

    expect(await within(dialog).findByText("3 of 22 unlocked")).toBeVisible();
    const mastery = achievement(dialog, "Export Mastery");
    expect(mastery).toHaveAttribute("data-tier", "silver");
    expect(within(mastery).getByText("Silver")).toBeVisible();
    expect(within(mastery).getByText("Next: Gold")).toBeVisible();
    expect(within(mastery).getByText("37 / 100")).toBeVisible();
    expect(
      within(mastery).getByRole("progressbar", { name: "Export Mastery progress" }),
    ).toHaveAttribute("aria-valuetext", "37 of 100");
    expect(within(mastery).getByText("Silver unlocked Oct 12, 2026")).toBeVisible();
    expect(
      within(mastery).getByRole("listitem", { name: "Bronze, 1, unlocked Jan 15, 2026" }),
    ).toHaveAttribute("data-state", "unlocked");
    expect(within(mastery).getByRole("listitem", { name: "Gold, 100, locked" })).toHaveAttribute(
      "data-state",
      "locked",
    );
    // Chips show the medal and the threshold only; the tier name is in the accessible label.
    expect(
      within(mastery)
        .getAllByRole("listitem")
        .map((chip) => chip.textContent),
    ).toEqual(["1", "10", "100"]);

    expect(achievement(dialog, "GIF Creator")).toHaveAttribute("data-tier", "bronze");
  });

  it("marks a series complete after Gold", async () => {
    mocks.getAchievementRecords.mockResolvedValue({
      ...emptyAchievementRecords,
      unlockedAchievements: {
        "lossless-precision-bronze": unlockedAt,
        "lossless-precision-gold": unlockedAt,
        "lossless-precision-silver": unlockedAt,
      },
    });
    mocks.getUsageStatistics.mockResolvedValue({ ...emptyUsageStatistics, losslessExports: 64 });
    renderDialog();

    const dialog = await openDialog();

    const precision = achievement(dialog, "Lossless Precision");
    expect(precision).toHaveAttribute("data-state", "completed");
    expect(precision).toHaveAttribute("data-tier", "gold");
    expect(within(precision).getByText("Completed")).toBeVisible();
    expect(within(precision).getByText("All tiers unlocked")).toBeVisible();
    expect(within(precision).queryByRole("progressbar")).toBeNull();
  });

  it("conceals a secret achievement until it is unlocked", async () => {
    mocks.getAchievementRecords.mockResolvedValue({
      ...emptyAchievementRecords,
      discoveredSplashMessageIds: ["rainbow-mode", "chosen-frame"],
    });
    mocks.getUsageStatistics.mockResolvedValue(emptyUsageStatistics);
    const store = renderDialog();

    const dialog = await openDialog();

    const secret = achievement(dialog, "???");
    expect(
      within(secret).getByText("A secret achievement. Keep exploring to reveal it"),
    ).toBeVisible();
    expect(within(secret).queryByRole("progressbar")).toBeNull();
    expect(within(dialog).queryByText("The Chosen One")).toBeNull();
    expect(within(dialog).queryByText("Encounter every legendary splash message")).toBeNull();

    act(() => {
      store.dispatch(
        achievementRecordsUpdated({
          records: {
            ...emptyAchievementRecords,
            unlockedAchievements: { "the-chosen-one": unlockedAt },
          },
        }),
      );
    });

    const revealed = achievement(dialog, "The Chosen One");
    expect(within(revealed).getByText("Encounter every legendary splash message")).toBeVisible();
    expect(within(dialog).queryByText("???")).toBeNull();
    expect(within(dialog).getByText("1 of 22 unlocked")).toBeVisible();
  });

  it("filters series with unlocked tiers and series with locked tiers", async () => {
    mocks.getAchievementRecords.mockResolvedValue({
      ...emptyAchievementRecords,
      unlockedAchievements: {
        "audio-specialist-bronze": unlockedAt,
        "audio-specialist-gold": unlockedAt,
        "audio-specialist-silver": unlockedAt,
        "gif-creator-bronze": unlockedAt,
      },
    });
    mocks.getUsageStatistics.mockResolvedValue(emptyUsageStatistics);
    renderDialog();
    const dialog = await openDialog();
    await within(dialog).findByText("4 of 22 unlocked");

    await userEvent.click(within(dialog).getByRole("tab", { name: "Unlocked" }));
    expect(cards(dialog)).toHaveLength(2);
    expect(within(dialog).getByText("GIF Creator")).toBeVisible();
    expect(within(dialog).getByText("Audio Specialist")).toBeVisible();

    await userEvent.click(within(dialog).getByRole("tab", { name: "Locked" }));
    expect(cards(dialog)).toHaveLength(7);
    expect(within(dialog).getByText("GIF Creator")).toBeVisible();
    expect(within(dialog).queryByText("Audio Specialist")).toBeNull();
  });

  it("explains an empty filter", async () => {
    mocks.getAchievementRecords.mockResolvedValue(emptyAchievementRecords);
    mocks.getUsageStatistics.mockResolvedValue(emptyUsageStatistics);
    renderDialog();
    const dialog = await openDialog();
    await within(dialog).findByText("0 of 22 unlocked");

    await userEvent.click(within(dialog).getByRole("tab", { name: "Unlocked" }));

    expect(within(dialog).getByText("No achievements unlocked yet")).toBeVisible();
  });

  it("marks achievements unlocked since the last view as new until the dialog closes", async () => {
    const viewedAt = Date.UTC(2026, 9, 1, 12);
    const records = {
      ...emptyAchievementRecords,
      unlockedAchievements: {
        "export-mastery-bronze": Date.UTC(2026, 8, 30, 12),
        "export-mastery-silver": Date.UTC(2026, 9, 2, 12),
        "gif-creator-bronze": Date.UTC(2026, 8, 30, 12),
      },
      viewedAtMillis: viewedAt,
    };

    mocks.getAchievementRecords.mockResolvedValue(records);
    mocks.getUsageStatistics.mockResolvedValue({ ...emptyUsageStatistics, optimizedExports: 12 });
    mocks.markAchievementsViewed.mockResolvedValue({ ...records, viewedAtMillis: viewedAt + 10 });
    renderDialog();

    const dialog = await openDialog();
    const mastery = await waitFor(() => achievement(dialog, "Export Mastery"));

    expect(mastery.querySelectorAll("[data-slot='achievement-new']")).toHaveLength(2);
    expect(within(mastery).getByText("New")).toBeInTheDocument();
    expect(
      within(mastery).getByRole("listitem", { name: "Silver, 10, unlocked Oct 2, 2026, new" }),
    ).toBeVisible();
    expect(
      within(mastery).getByRole("listitem", { name: "Bronze, 1, unlocked Sep 30, 2026" }),
    ).toBeVisible();
    expect(
      achievement(dialog, "GIF Creator").querySelector("[data-slot='achievement-new']"),
    ).toBeNull();
    expect(mocks.markAchievementsViewed).not.toHaveBeenCalled();

    await userEvent.keyboard("{Escape}");

    await waitFor(() => expect(mocks.markAchievementsViewed).toHaveBeenCalledTimes(1));
  });

  it("offers a retry when achievements cannot be loaded", async () => {
    mocks.getAchievementRecords.mockRejectedValueOnce({ code: "internal" });
    mocks.getAchievementRecords.mockResolvedValue(emptyAchievementRecords);
    mocks.getUsageStatistics.mockResolvedValue(emptyUsageStatistics);
    renderDialog();

    const dialog = await openDialog();
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Achievements could not be loaded",
    );

    await userEvent.click(within(dialog).getByRole("button", { name: "Retry" }));

    expect(await within(dialog).findByText("0 of 22 unlocked")).toBeVisible();
  });
});

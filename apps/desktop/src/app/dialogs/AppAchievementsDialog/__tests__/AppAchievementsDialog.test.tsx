import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAchievementRecords: vi.fn(),
  getUsageStatistics: vi.fn(),
}));

vi.mock("@/lib/tauri/achievements", () => ({
  getAchievementRecords: mocks.getAchievementRecords,
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

  it("shows an empty collection with every achievement locked", async () => {
    mocks.getAchievementRecords.mockResolvedValue(emptyAchievementRecords);
    mocks.getUsageStatistics.mockResolvedValue(emptyUsageStatistics);
    renderDialog();

    const dialog = await openDialog();

    expect(await within(dialog).findByText("0 of 13 unlocked")).toBeVisible();
    expect(
      within(dialog).getByRole("progressbar", { name: "Collection progress" }),
    ).toHaveAttribute("aria-valuenow", "0");
    expect(within(dialog).getAllByRole("listitem")).toHaveLength(13);
    expect(within(achievement(dialog, "First Export")).getByText("Locked")).toBeVisible();
    expect(
      within(dialog).getByText(
        "Achievements are tracked locally on this device and are never shared or sent anywhere",
      ),
    ).toBeVisible();
  });

  it("presents unlock dates and progress toward locked achievements", async () => {
    mocks.getAchievementRecords.mockResolvedValue({
      ...emptyAchievementRecords,
      unlockedAchievements: {
        "export-veteran": unlockedAt,
        "first-export": unlockedAt,
        "getting-started": unlockedAt,
      },
    });
    mocks.getUsageStatistics.mockResolvedValue({ ...emptyUsageStatistics, optimizedExports: 150 });
    renderDialog();

    const dialog = await openDialog();

    expect(await within(dialog).findByText("3 of 13 unlocked")).toBeVisible();
    const veteran = achievement(dialog, "Export Veteran");
    expect(veteran).toHaveAttribute("data-state", "unlocked");
    expect(within(veteran).getByText("Unlocked")).toBeVisible();
    expect(within(veteran).getByText("Unlocked Oct 12, 2026")).toBeVisible();
    expect(within(veteran).queryByRole("progressbar")).toBeNull();

    const legend = achievement(dialog, "Export Legend");
    expect(legend).toHaveAttribute("data-state", "locked");
    expect(within(legend).getByText("150 / 1,000")).toBeVisible();
    expect(
      within(legend).getByRole("progressbar", { name: "Export Legend progress" }),
    ).toHaveAttribute("aria-valuetext", "150 of 1,000");
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
    expect(within(dialog).getByText("1 of 13 unlocked")).toBeVisible();
  });

  it("filters unlocked and locked achievements", async () => {
    mocks.getAchievementRecords.mockResolvedValue({
      ...emptyAchievementRecords,
      unlockedAchievements: { "gif-maker": unlockedAt },
    });
    mocks.getUsageStatistics.mockResolvedValue(emptyUsageStatistics);
    renderDialog();
    const dialog = await openDialog();
    await within(dialog).findByText("1 of 13 unlocked");

    await userEvent.click(within(dialog).getByRole("tab", { name: "Unlocked" }));
    expect(within(dialog).getAllByRole("listitem")).toHaveLength(1);
    expect(within(dialog).getByText("GIF Maker")).toBeVisible();

    await userEvent.click(within(dialog).getByRole("tab", { name: "Locked" }));
    expect(within(dialog).getAllByRole("listitem")).toHaveLength(12);
    expect(within(dialog).queryByText("GIF Maker")).toBeNull();
  });

  it("explains an empty filter", async () => {
    mocks.getAchievementRecords.mockResolvedValue(emptyAchievementRecords);
    mocks.getUsageStatistics.mockResolvedValue(emptyUsageStatistics);
    renderDialog();
    const dialog = await openDialog();
    await within(dialog).findByText("0 of 13 unlocked");

    await userEvent.click(within(dialog).getByRole("tab", { name: "Unlocked" }));

    expect(within(dialog).getByText("No achievements unlocked yet")).toBeVisible();
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

    expect(await within(dialog).findByText("0 of 13 unlocked")).toBeVisible();
  });
});

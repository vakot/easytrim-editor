import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getAchievementRecords: vi.fn(), getUsageStatistics: vi.fn() }));

vi.mock("@/lib/tauri/statistics", () => ({ getUsageStatistics: mocks.getUsageStatistics }));
vi.mock("@/lib/tauri/achievements", () => ({
  getAchievementRecords: mocks.getAchievementRecords,
  recordSplashMessageDiscovery: vi.fn(),
  unlockAchievements: vi.fn(),
}));

import { useStatisticsDialog } from "@/app/hooks/useAppDialog";
import { AppDialogsProvider } from "@/app/providers/AppDialogsProvider";
import { achievementRecordsUpdated } from "@/app/store/slices/achievements-slice";
import { editingInstanceExportCompleted } from "@/app/store/slices/editing-instances-slice";
import { createAppStore } from "@/app/store/store";
import type { UsageStatistics } from "@/domain/usage-statistics";
import { i18n } from "@/i18n/config";
import { emptyAchievementRecords } from "@/test/achievement-records.fixtures";
import { emptyUsageStatistics } from "@/test/usage-statistics.fixtures";

import { AppStatisticsDialog } from "../AppStatisticsDialog";

function OpenStatisticsButton() {
  const { openDialog } = useStatisticsDialog();
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
        <OpenStatisticsButton />
        <AppStatisticsDialog />
      </AppDialogsProvider>
    </Provider>,
  );
  return store;
}

async function openDialog() {
  await userEvent.click(screen.getByRole("button", { name: "Open" }));
  return screen.findByRole("dialog", { name: "Statistics" });
}

function metric(dialog: HTMLElement, label: string) {
  const item = within(dialog).getByText(label).closest("[data-slot='item']");
  if (!(item instanceof HTMLElement)) throw new Error(`Metric ${label} is not rendered.`);
  return item;
}

const recorded: UsageStatistics = {
  audioExports: 7,
  firstExportAtMillis: Date.UTC(2026, 0, 15, 12),
  gifExports: 2,
  lastExportAtMillis: Date.UTC(2026, 2, 1, 12),
  longestExportMillis: 123_000,
  losslessExports: 3,
  outputBytes: 3 * 1_024 * 1_024,
  processingMillis: 3_723_000,
  optimizedExports: 1_200,
  sourceBytes: 2 * 1_024 * 1_024,
};

describe("AppStatisticsDialog", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
    mocks.getUsageStatistics.mockReset();
    mocks.getAchievementRecords.mockReset();
    mocks.getAchievementRecords.mockResolvedValue(emptyAchievementRecords);
  });

  it("shows zero values and explains when statistics start before the first export", async () => {
    mocks.getUsageStatistics.mockResolvedValue(emptyUsageStatistics);
    renderDialog();

    const dialog = await openDialog();

    expect(
      await within(dialog).findByText(
        "Statistics begin accumulating after your first successful export",
      ),
    ).toBeVisible();
    expect(within(metric(dialog, "Completed Exports")).getByText("0")).toBeVisible();
    expect(within(metric(dialog, "Processing Time")).getByText("0:00")).toBeVisible();
    expect(within(metric(dialog, "Longest Export")).getByText("0:00")).toBeVisible();
    expect(within(metric(dialog, "Storage Saved")).getByText("0 B")).toBeVisible();
    expect(within(metric(dialog, "First Export")).getByText("Not yet")).toBeVisible();
    expect(within(metric(dialog, "Last Export")).getByText("Not yet")).toBeVisible();
    expect(
      within(dialog).getByText(
        "Statistics are generated locally on this device and are never shared or sent anywhere",
      ),
    ).toBeVisible();
  });

  it("presents recorded totals, including storage growth", async () => {
    mocks.getUsageStatistics.mockResolvedValue(recorded);
    renderDialog();

    const dialog = await openDialog();

    expect(await within(metric(dialog, "Completed Exports")).findByText("1,212")).toBeVisible();
    expect(within(metric(dialog, "Optimized Exports")).getByText("1,200")).toBeVisible();
    expect(within(metric(dialog, "Lossless Cuts")).getByText("3")).toBeVisible();
    expect(within(metric(dialog, "GIF Exports")).getByText("2")).toBeVisible();
    expect(within(metric(dialog, "Audio Exports")).getByText("7")).toBeVisible();
    expect(within(metric(dialog, "Processing Time")).getByText("1:02:03")).toBeVisible();
    expect(within(metric(dialog, "Longest Export")).getByText("2:03")).toBeVisible();
    const overview = within(dialog).getByRole("region", { name: "Overview" });
    expect(within(overview).getAllByRole("listitem")[3]).toBe(metric(dialog, "Longest Export"));
    expect(
      within(metric(dialog, "Longest Export")).getByText(
        "Longest time spent processing a single export",
      ),
    ).toBeVisible();
    expect(within(metric(dialog, "Source Data Processed")).getByText("2.0 MB")).toBeVisible();
    expect(within(metric(dialog, "Output Data Generated")).getByText("3.0 MB")).toBeVisible();
    const storageSaved = metric(dialog, "Storage Saved");
    expect(within(storageSaved).getByText("-1.0 MB")).toBeVisible();
    expect(within(storageSaved).getByText("Exports are larger than their sources")).toBeVisible();
    expect(within(metric(dialog, "First Export")).getByText(/Jan 15, 2026/)).toBeVisible();
    expect(
      within(dialog).queryByText(
        "Statistics begin accumulating after your first successful export",
      ),
    ).toBeNull();
  });

  it("shows the longest export in Russian", async () => {
    await i18n.changeLanguage("ru");
    mocks.getUsageStatistics.mockResolvedValue(recorded);
    renderDialog();
    await userEvent.click(screen.getByRole("button", { name: "Open" }));
    const dialog = await screen.findByRole("dialog", { name: "Статистика" });
    const longest = metric(dialog, "Самый долгий экспорт");
    expect(within(longest).getByText("2:03")).toBeVisible();
    expect(within(longest).getByText("Максимальное время обработки одного экспорта")).toBeVisible();
  });

  it("updates while open when an export completes", async () => {
    mocks.getUsageStatistics.mockResolvedValue(emptyUsageStatistics);
    const store = renderDialog();
    const dialog = await openDialog();
    expect(await within(metric(dialog, "Lossless Cuts")).findByText("0")).toBeVisible();

    mocks.getUsageStatistics.mockResolvedValue({
      ...emptyUsageStatistics,
      longestExportMillis: 1_000,
      losslessExports: 1,
    });
    act(() => {
      store.dispatch(
        editingInstanceExportCompleted({
          attemptId: "attempt-1",
          durationMs: 1_000,
          id: "instance-1",
          result: { displayName: "out.mp4", displayPath: "out.mp4", operationId: "operation-1" },
        }),
      );
    });

    expect(await within(metric(dialog, "Lossless Cuts")).findByText("1")).toBeVisible();
    expect(within(metric(dialog, "Longest Export")).getByText("0:01")).toBeVisible();
  });

  it("counts unlocked achievements and updates when one unlocks", async () => {
    mocks.getUsageStatistics.mockResolvedValue(emptyUsageStatistics);
    mocks.getAchievementRecords.mockResolvedValue({
      ...emptyAchievementRecords,
      unlockedAchievements: { "export-mastery-bronze": 1, "first-export": 2 },
    });
    const store = renderDialog();

    const dialog = await openDialog();
    const achievements = await within(dialog).findByText("Achievements Unlocked");
    const item = achievements.closest("[data-slot='item']");
    if (!(item instanceof HTMLElement)) throw new Error("Achievements metric is not rendered.");
    expect(within(item).getByText("1 / 31")).toBeVisible();

    act(() => {
      store.dispatch(
        achievementRecordsUpdated({
          records: {
            ...emptyAchievementRecords,
            unlockedAchievements: { "gif-creator-bronze": 3 },
          },
        }),
      );
    });

    expect(within(item).getByText("2 / 31")).toBeVisible();
  });

  it("offers a retry when statistics cannot be loaded", async () => {
    mocks.getUsageStatistics.mockRejectedValueOnce({ code: "internal" });
    mocks.getUsageStatistics.mockResolvedValue(emptyUsageStatistics);
    renderDialog();

    const dialog = await openDialog();
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Statistics could not be loaded",
    );

    await userEvent.click(within(dialog).getByRole("button", { name: "Retry" }));

    expect(await within(metric(dialog, "Completed Exports")).findByText("0")).toBeVisible();
  });
});

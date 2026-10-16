import { act, render, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AchievementRecords } from "@/domain/achievement-records";

const mocks = vi.hoisted(() => ({
  chooseSplashMessage: vi.fn(),
  getAchievementRecords: vi.fn(),
  getUsageStatistics: vi.fn(),
  recordSplashMessageDiscovery: vi.fn(),
  toast: vi.fn(),
  unlockAchievements: vi.fn(),
}));

vi.mock("../../lib/splash-messages.utils", () => ({
  chooseSplashMessage: mocks.chooseSplashMessage,
}));
vi.mock("@/lib/tauri/achievements", () => ({
  getAchievementRecords: mocks.getAchievementRecords,
  recordSplashMessageDiscovery: mocks.recordSplashMessageDiscovery,
  unlockAchievements: mocks.unlockAchievements,
}));
vi.mock("@/lib/tauri/statistics", () => ({ getUsageStatistics: mocks.getUsageStatistics }));
vi.mock("sonner", () => ({ toast: mocks.toast }));

import {
  achievementRecordsUpdated,
  achievementsInitialized,
} from "@/app/store/slices/achievements-slice";
import { createAppStore } from "@/app/store/store";
import { i18n } from "@/i18n/config";
import { emptyAchievementRecords } from "@/test/achievement-records.fixtures";
import { emptyUsageStatistics } from "@/test/usage-statistics.fixtures";

import { splashMessagesCommon, splashMessagesLegendary } from "../../consts/splash-messages.consts";
import type { SplashMessageDefinition } from "../../types/splash-messages.types";
import { AchievementTracker } from "../AchievementTracker";
import { SplashMessages } from "../SplashMessages";

const [legendary] = splashMessagesLegendary;
const legendaryIds = splashMessagesLegendary.map((message) => message.id);

let intersect: (isIntersecting: boolean) => void = () => undefined;

class IntersectionObserverMock {
  constructor(callback: IntersectionObserverCallback) {
    intersect = (isIntersecting) =>
      callback(
        [{ isIntersecting } as IntersectionObserverEntry],
        this as unknown as IntersectionObserver,
      );
  }
  disconnect() {
    intersect = () => undefined;
  }
  observe() {}
}

function createStore() {
  return createAppStore({
    getItem: async () => null,
    setItem: async () => undefined,
    removeItem: async () => undefined,
  });
}

function renderSplash(
  options: { fixedMessage?: SplashMessageDefinition; initialized?: boolean } = {},
) {
  const store = createStore();
  if (options.initialized ?? true) store.dispatch(achievementsInitialized());
  render(
    <Provider store={store}>
      <SplashMessages message={options.fixedMessage} />
    </Provider>,
  );
  return store;
}

function displayOnScreen() {
  act(() => intersect(true));
}

describe("SplashMessages legendary discovery", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
    vi.resetAllMocks();
    vi.stubGlobal("IntersectionObserver", IntersectionObserverMock);
    mocks.recordSplashMessageDiscovery.mockImplementation(async (id: string) => ({
      ...emptyAchievementRecords,
      discoveredSplashMessageIds: [id],
    }));
  });

  afterEach(() => vi.unstubAllGlobals());

  it("records a legendary message once it is displayed on screen", async () => {
    mocks.chooseSplashMessage.mockReturnValue(legendary);
    renderSplash();

    act(() => intersect(false));
    expect(mocks.recordSplashMessageDiscovery).not.toHaveBeenCalled();

    displayOnScreen();
    await waitFor(() =>
      expect(mocks.recordSplashMessageDiscovery).toHaveBeenCalledWith(legendary!.id),
    );
    displayOnScreen();
    expect(mocks.recordSplashMessageDiscovery).toHaveBeenCalledTimes(1);
  });

  it("does not record a legendary message that was already discovered", async () => {
    mocks.chooseSplashMessage.mockReturnValue(legendary);
    const store = renderSplash();
    act(() => {
      store.dispatch(
        achievementRecordsUpdated({
          records: { ...emptyAchievementRecords, discoveredSplashMessageIds: [legendary!.id] },
        }),
      );
    });

    displayOnScreen();

    await Promise.resolve();
    expect(mocks.recordSplashMessageDiscovery).not.toHaveBeenCalled();
  });

  it("ignores messages that are not legendary", () => {
    mocks.chooseSplashMessage.mockReturnValue(splashMessagesCommon[0]);
    renderSplash();

    displayOnScreen();

    expect(mocks.recordSplashMessageDiscovery).not.toHaveBeenCalled();
  });

  it("never records a fixed preview message", () => {
    renderSplash({ fixedMessage: legendary });

    displayOnScreen();

    expect(mocks.chooseSplashMessage).not.toHaveBeenCalled();
    expect(mocks.recordSplashMessageDiscovery).not.toHaveBeenCalled();
  });

  it("waits for the retroactive unlocks before recording", async () => {
    mocks.chooseSplashMessage.mockReturnValue(legendary);
    const store = renderSplash({ initialized: false });

    displayOnScreen();
    expect(mocks.recordSplashMessageDiscovery).not.toHaveBeenCalled();

    act(() => {
      store.dispatch(achievementsInitialized());
    });
    displayOnScreen();

    await waitFor(() => expect(mocks.recordSplashMessageDiscovery).toHaveBeenCalledTimes(1));
  });

  it("unlocks and announces The Chosen One after the last legendary discovery", async () => {
    let records: AchievementRecords = {
      ...emptyAchievementRecords,
      discoveredSplashMessageIds: legendaryIds.slice(0, 4),
    };

    mocks.getAchievementRecords.mockImplementation(async () => records);
    mocks.getUsageStatistics.mockResolvedValue(emptyUsageStatistics);
    mocks.recordSplashMessageDiscovery.mockImplementation(async (id: string) => {
      records = {
        ...records,
        discoveredSplashMessageIds: [...records.discoveredSplashMessageIds, id],
      };
      return records;
    });
    mocks.unlockAchievements.mockImplementation(async (ids: string[]) => {
      records = {
        ...records,
        unlockedAchievements: {
          ...records.unlockedAchievements,
          ...Object.fromEntries(ids.map((id) => [id, 1_000])),
        },
      };
      return { records, unlockedAchievementIds: ids };
    });
    mocks.chooseSplashMessage.mockReturnValue(splashMessagesLegendary[4]);
    const store = createStore();
    render(
      <Provider store={store}>
        <AchievementTracker />
        <SplashMessages />
      </Provider>,
    );
    await waitFor(() => expect(store.getState().achievements.initialized).toBe(true));
    expect(mocks.unlockAchievements).not.toHaveBeenCalled();

    displayOnScreen();

    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith(
        "The Chosen One",
        expect.objectContaining({ description: "Achievement unlocked" }),
      ),
    );
    expect(mocks.unlockAchievements).toHaveBeenCalledWith(["the-chosen-one"]);
  });
});

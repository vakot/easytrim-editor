import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { achievementRecordsUpdated } from "@/app/store/slices/achievements-slice";
import { createAppStore } from "@/app/store/store";
import { STORAGE_KEYS } from "@/lib/storage.consts";
import {
  almostCompleteGettingStartedRecords,
  completeAchievementRecords,
  emptyAchievementRecords,
  partiallyUnlockedAchievementScenario,
} from "@/test/achievement-records.fixtures";

import { VideoPreviewEmpty } from "../VideoPreviewEmpty";

describe("VideoPreviewEmpty achievements", () => {
  beforeEach(() => localStorage.removeItem(STORAGE_KEYS.onboardingCompleted));
  it.each([
    ["locked", emptyAchievementRecords, 0],
    ["partially unlocked", partiallyUnlockedAchievementScenario.records, 1],
    ["one task remaining", almostCompleteGettingStartedRecords, 5],
  ] as const)("shows the actual Getting Started cards when %s", (_state, records, unlocked) => {
    const store = createAppStore();
    store.dispatch(achievementRecordsUpdated({ records }));
    render(
      <Provider store={store}>
        <VideoPreviewEmpty />
      </Provider>,
    );

    const category = screen.getByRole("region", { name: "Getting Started" });
    const cards = within(category).getAllByRole("listitem");
    expect(cards).toHaveLength(6);
    expect(within(category).queryByText("Locked")).not.toBeInTheDocument();
    expect(within(category).queryByText("Unlocked")).not.toBeInTheDocument();
    expect(within(category).queryAllByText("Completed")).toHaveLength(unlocked);
    expect(cards.filter((card) => card.dataset.state === "unlocked")).toHaveLength(unlocked);
    expect(within(category).queryByText(/^Completed .+/)).not.toBeInTheDocument();
    expect(within(category).queryByText("New")).not.toBeInTheDocument();
    expect(category.querySelector("[data-slot='achievement-new']")).toBeNull();
    expect(screen.getByRole("link", { name: /Ko-fi/i })).toBeInTheDocument();
    expect(screen.queryByText("Secret Discoveries")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Finish onboarding" })).not.toBeInTheDocument();
  });

  it("hides onboarding and confirmation until records load", () => {
    const store = createAppStore();
    render(
      <Provider store={store}>
        <VideoPreviewEmpty />
      </Provider>,
    );
    expect(screen.queryByRole("region", { name: "Getting Started" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Finish onboarding" })).not.toBeInTheDocument();
  });

  it("waits for confirmation with already-complete records and remembers it after remounting", async () => {
    const user = userEvent.setup();
    const store = createAppStore();
    store.dispatch(achievementRecordsUpdated({ records: completeAchievementRecords }));
    const view = render(
      <Provider store={store}>
        <VideoPreviewEmpty />
      </Provider>,
    );

    expect(screen.getByRole("region", { name: "Getting Started" })).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(localStorage.getItem(STORAGE_KEYS.onboardingCompleted)).toBeNull();
    await user.click(screen.getByRole("button", { name: "Finish onboarding" }));
    expect(localStorage.getItem(STORAGE_KEYS.onboardingCompleted)).toBe("true");
    view.unmount();
    render(
      <Provider store={store}>
        <VideoPreviewEmpty />
      </Provider>,
    );
    expect(screen.queryByRole("region", { name: "Getting Started" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Finish onboarding" })).not.toBeInTheDocument();
  });

  it("shows incomplete tasks after records arrive and exits only after manual confirmation", async () => {
    const store = createAppStore();
    render(
      <Provider store={store}>
        <VideoPreviewEmpty />
      </Provider>,
    );
    const support = screen.getByRole("link", { name: /Ko-fi/i });
    expect(screen.queryByRole("region", { name: "Getting Started" })).not.toBeInTheDocument();
    act(() => {
      store.dispatch(
        achievementRecordsUpdated({ records: partiallyUnlockedAchievementScenario.records }),
      );
    });
    expect(screen.getByRole("region", { name: "Getting Started" })).toBeInTheDocument();
    act(() => {
      store.dispatch(achievementRecordsUpdated({ records: almostCompleteGettingStartedRecords }));
    });
    expect(screen.getByRole("region", { name: "Getting Started" })).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    act(() => {
      store.dispatch(achievementRecordsUpdated({ records: completeAchievementRecords }));
    });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(localStorage.getItem(STORAGE_KEYS.onboardingCompleted)).toBeNull();
    await userEvent.setup().click(screen.getByRole("button", { name: "Finish onboarding" }));
    expect(screen.getByRole("status")).toHaveTextContent("Completed");
    expect(screen.getByRole("status").querySelector("[data-slot='confetti']")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Getting Started" })).toBeInTheDocument();
    await waitFor(
      () =>
        expect(screen.queryByRole("region", { name: "Getting Started" })).not.toBeInTheDocument(),
      { timeout: 4_000 },
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ko-fi/i })).toBe(support);
  });

  it("reflects live unlocks without changing the viewed mark or dispatching view effects", () => {
    const store = createAppStore();
    store.dispatch(
      achievementRecordsUpdated({ records: { ...emptyAchievementRecords, viewedAtMillis: 123 } }),
    );
    const dispatch = vi.spyOn(store, "dispatch");
    const { unmount } = render(
      <Provider store={store}>
        <VideoPreviewEmpty />
      </Provider>,
    );

    expect(dispatch).not.toHaveBeenCalled();

    act(() => {
      store.dispatch(achievementRecordsUpdated({ records: completeAchievementRecords }));
    });
    expect(
      within(screen.getByRole("region", { name: "Getting Started" })).getAllByText("Completed"),
    ).toHaveLength(6);
    dispatch.mockClear();
    unmount();
    expect(dispatch).not.toHaveBeenCalled();
    expect(store.getState().achievements.records?.viewedAtMillis).toBe(123);
  });
});

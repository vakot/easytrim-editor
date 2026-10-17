import { act, render, screen, within } from "@testing-library/react";
import { Provider } from "react-redux";
import { describe, expect, it, vi } from "vitest";

import { achievementRecordsUpdated } from "@/app/store/slices/achievements-slice";
import { createAppStore } from "@/app/store/store";
import {
  completeAchievementRecords,
  emptyAchievementRecords,
  partiallyUnlockedAchievementScenario,
} from "@/test/achievement-records.fixtures";

import { VideoPreviewEmpty } from "../VideoPreviewEmpty";

describe("VideoPreviewEmpty achievements", () => {
  it.each([
    ["locked", emptyAchievementRecords, 0],
    ["partially unlocked", partiallyUnlockedAchievementScenario.records, 1],
    ["fully unlocked", completeAchievementRecords, 6],
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
    expect(within(category).queryAllByText(/^Completed .+/)).toHaveLength(unlocked);
    expect(screen.getByRole("link", { name: /Ko-fi/i })).toBeInTheDocument();
    expect(screen.queryByText("Secret Discoveries")).not.toBeInTheDocument();
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

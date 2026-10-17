import { render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { beforeEach, describe, expect, it } from "vitest";

import { achievementRecordsLoaded } from "@/app/store/slices/achievements-slice";
import { createAppStore } from "@/app/store/store";
import type { AchievementRecords } from "@/domain/achievement-records";
import { i18n } from "@/i18n/config";
import { emptyAchievementRecords } from "@/test/achievement-records.fixtures";

import { achievementCollection } from "../../../consts/achievements.consts";
import type { StandaloneAchievementDefinition } from "../../../types/achievements.types";
import { AchievementStandaloneItem } from "../components/AchievementStandaloneItem";

const chosenOne = achievementCollection.flatMap((entry) =>
  entry.kind === "standalone" && entry.id === "the-chosen-one" ? [entry] : [],
)[0];

if (!chosenOne) throw new Error("The Chosen One is not in the collection.");

function renderCard(definition: StandaloneAchievementDefinition, records: AchievementRecords) {
  const store = createAppStore();
  store.dispatch(achievementRecordsLoaded({ records, requestId: "test" }));
  const card = (
    <Provider store={store}>
      <AchievementStandaloneItem definition={definition} />
    </Provider>
  );

  render(card);
  const item = document.querySelector<HTMLElement>("[data-slot='item']");
  if (!item) throw new Error("The card did not render.");
  return item;
}

describe("secret achievement card styling", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("applies the static iridescent treatment to an unlocked secret", () => {
    const card = renderCard(chosenOne, {
      ...emptyAchievementRecords,
      unlockedAchievements: { "the-chosen-one": 1_000 },
    });

    expect(card).toHaveAttribute("data-secret", "true");
    expect(card).toHaveAttribute("data-secret-state", "unlocked");
    expect(card.querySelector("[data-slot='achievement-secret-frame']")).toBeNull();
    expect(card.querySelector("svg defs linearGradient")).not.toBeNull();
    expect(card.style.getPropertyValue("--secret-icon-stroke")).toMatch(
      /^url\(#achievement-secret-/,
    );
  });

  it("keeps a locked secret concealed", () => {
    const card = renderCard(chosenOne, emptyAchievementRecords);

    expect(card).toHaveAttribute("data-secret-state", "locked");
    expect(screen.getByText("???")).toBeInTheDocument();
    expect(screen.queryByText("The Chosen One")).not.toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });
});

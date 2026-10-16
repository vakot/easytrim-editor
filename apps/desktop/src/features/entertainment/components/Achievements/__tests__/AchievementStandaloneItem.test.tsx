import { render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { beforeEach, describe, expect, it } from "vitest";

import { achievementRecordsLoaded } from "@/app/store/slices/achievements-slice";
import { createAppStore } from "@/app/store/store";
import type { AchievementRecords } from "@/domain/achievement-records";
import { i18n } from "@/i18n/config";
import { emptyAchievementRecords } from "@/test/achievement-records.fixtures";

import { defaultAchievementSecretStyle } from "../../../consts/achievement-secret-style.consts";
import { achievementCollection } from "../../../consts/achievements.consts";
import type {
  AchievementSecretStyle,
  StandaloneAchievementDefinition,
} from "../../../types/achievements.types";
import { AchievementStandaloneItem } from "../components/AchievementStandaloneItem";
import { AchievementSecretStyleContext } from "../contexts/AchievementSecretStyleContext";

const chosenOne = achievementCollection.flatMap((entry) =>
  entry.kind === "standalone" && entry.id === "the-chosen-one" ? [entry] : [],
)[0];

if (!chosenOne) throw new Error("The Chosen One is not in the collection.");

function renderCard(
  definition: StandaloneAchievementDefinition,
  records: AchievementRecords,
  style?: AchievementSecretStyle,
) {
  const store = createAppStore();
  store.dispatch(achievementRecordsLoaded({ records, requestId: "test" }));
  const card = (
    <Provider store={store}>
      <AchievementStandaloneItem definition={definition} />
    </Provider>
  );

  render(
    style ? (
      <AchievementSecretStyleContext.Provider value={style}>
        {card}
      </AchievementSecretStyleContext.Provider>
    ) : (
      card
    ),
  );
  const item = document.querySelector<HTMLElement>("[data-slot='item']");
  if (!item) throw new Error("The card did not render.");
  return item;
}

describe("secret achievement card styling", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("marks an unlocked secret with the default variant and style custom properties", () => {
    const card = renderCard(chosenOne, {
      ...emptyAchievementRecords,
      unlockedAchievements: { "the-chosen-one": 1_000 },
    });

    expect(card).toHaveAttribute("data-secret-state", "unlocked");
    expect(card).toHaveAttribute("data-secret-variant", defaultAchievementSecretStyle.variant);
    expect(card.style.getPropertyValue("--secret-thickness")).toBe(
      `${defaultAchievementSecretStyle.thickness}px`,
    );
    expect(card.querySelector("[data-slot='achievement-secret-frame']")).not.toBeNull();
  });

  it("keeps a locked secret concealed while still framing it", () => {
    const card = renderCard(chosenOne, emptyAchievementRecords);

    expect(card).toHaveAttribute("data-secret-state", "locked");
    expect(screen.getByText("???")).toBeInTheDocument();
    expect(screen.queryByText("The Chosen One")).not.toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("applies the chosen variant, animation switch, and clamped sizes from the context", () => {
    const card = renderCard(
      chosenOne,
      { ...emptyAchievementRecords, unlockedAchievements: { "the-chosen-one": 1_000 } },
      {
        animated: false,
        glow: 4,
        iridescentIcon: false,
        thickness: 0,
        variant: "prismatic-holographic",
      },
    );

    expect(card).toHaveAttribute("data-secret-variant", "prismatic-holographic");
    expect(card).toHaveAttribute("data-secret-animated", "false");
    expect(card).toHaveAttribute("data-secret-icon", "plain");
    expect(card.style.getPropertyValue("--secret-glow")).toBe("1");
    expect(card.style.getPropertyValue("--secret-thickness")).toBe("1px");
    expect(card.querySelector("[class*='sheen']")).not.toBeNull();
  });
});

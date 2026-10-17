import { Crown, HardDrive, Medal } from "lucide-react";
import { beforeEach, describe, expect, it } from "vitest";

import { i18n } from "@/i18n/config";

import { achievementCollection } from "../../consts/achievements.consts";
import {
  createAchievementAnnouncements,
  getAchievementToastVariant,
} from "../achievement-announcements.utils";
import { getUnlockableAchievement } from "../achievements.utils";

const t = i18n.t.bind(i18n);

describe("createAchievementAnnouncements", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("localizes regular, tiered, and secret celebrations in Russian", () => {
    const announcements = createAchievementAnnouncements(
      ["first-contact", "data-cruncher-bronze", "the-chosen-one"],
      i18n.getFixedT("ru"),
    );

    expect(announcements).toMatchObject([
      {
        title: "Первый контакт",
        description: "Впервые импортируйте медиафайл",
        variant: "standard",
      },
      { title: "Укротитель данных", tierLabel: "Бронза", variant: "bronze" },
      {
        title: "Избранный",
        description: "Откройте все легендарные сообщения при запуске",
        variant: "secret",
      },
    ]);
    expect(
      announcements.every(({ unlockedLabel }) => unlockedLabel === "Достижение получено"),
    ).toBe(true);
  });

  it("announces a tier with its series copy and tier label", () => {
    expect(createAchievementAnnouncements(["data-cruncher-bronze"], t)).toEqual([
      {
        achievementId: "data-cruncher-bronze",
        description: i18n.t("achievements.items.dataCruncher.description"),
        icon: HardDrive,
        tier: "bronze",
        tierLabel: "Bronze",
        title: "Data Cruncher",
        unlockedLabel: "Achievement unlocked",
        variant: "bronze",
      },
    ]);
  });

  it("shows the real description of the achievement", () => {
    const [announcement] = createAchievementAnnouncements(["the-chosen-one"], t);

    expect(announcement).toMatchObject({
      description: i18n.t("achievements.items.theChosenOne.description"),
      icon: Crown,
      tier: null,
      tierLabel: null,
      title: "The Chosen One",
      variant: "secret",
    });
    expect(announcement?.description.length).toBeGreaterThan(0);
  });

  it("gives every achievement of the same unlock its own announcement in unlock order", () => {
    const ids = [
      "export-mastery-bronze",
      "export-mastery-silver",
      "export-mastery-gold",
      "gif-creator-bronze",
      "the-chosen-one",
    ];

    const announcements = createAchievementAnnouncements(ids, t);

    expect(announcements.map((announcement) => announcement.achievementId)).toEqual(ids);
    expect(announcements.map((announcement) => announcement.variant)).toEqual([
      "bronze",
      "silver",
      "gold",
      "bronze",
      "secret",
    ]);
    expect(announcements.map((announcement) => announcement.tierLabel)).toEqual([
      "Bronze",
      "Silver",
      "Gold",
      "Bronze",
      null,
    ]);
  });

  it("announces a collector as a secret together with the tier that completes it", () => {
    const announcements = createAchievementAnnouncements(
      ["storage-saver-bronze", "first-contact", "bronze-collector"],
      t,
    );

    expect(announcements.map((announcement) => [announcement.title, announcement.variant])).toEqual(
      [
        ["Storage Saver", "bronze"],
        ["First Contact", "standard"],
        ["Bronze Collector", "secret"],
      ],
    );
    expect(announcements[2]).toMatchObject({ icon: Medal, tier: null });
  });

  it("announces nothing for unknown achievements and keeps the known ones", () => {
    expect(createAchievementAnnouncements(["first-export"], t)).toEqual([]);
    expect(createAchievementAnnouncements([], t)).toEqual([]);
    expect(
      createAchievementAnnouncements(["first-export", "fine-tuning"], t).map(
        (announcement) => announcement.achievementId,
      ),
    ).toEqual(["fine-tuning"]);
  });

  it("follows the active language", async () => {
    await i18n.changeLanguage("ru");
    const [russian] = createAchievementAnnouncements(["fine-tuning"], i18n.t.bind(i18n));
    await i18n.changeLanguage("en");
    const [english] = createAchievementAnnouncements(["fine-tuning"], i18n.t.bind(i18n));

    expect(russian?.unlockedLabel).toBeTruthy();
    expect(english?.title).toBe("Fine Tuning");
  });
});

describe("getAchievementToastVariant", () => {
  it("derives the variant from the definition and unlocked tier", () => {
    const variants = Object.fromEntries(
      [
        "fine-tuning",
        "first-contact",
        "gif-creator-bronze",
        "gif-creator-silver",
        "gif-creator-gold",
        "the-chosen-one",
        "silver-collector",
      ].map((id) => [id, getAchievementToastVariant(getUnlockableAchievement(id)!)]),
    );

    expect(variants).toEqual({
      "fine-tuning": "standard",
      "first-contact": "standard",
      "gif-creator-bronze": "bronze",
      "gif-creator-gold": "gold",
      "gif-creator-silver": "silver",
      "silver-collector": "secret",
      "the-chosen-one": "secret",
    });
  });

  it("covers every achievement in the registry, so new ones need no extra toast code", () => {
    const secretIds: string[] = achievementCollection
      .filter((entry) => entry.kind === "standalone" && "secret" in entry && entry.secret)
      .map((entry) => entry.id);

    for (const entry of achievementCollection) {
      const ids =
        entry.kind === "series"
          ? ["bronze", "silver", "gold"].map((tier) => `${entry.id}-${tier}`)
          : [entry.id];

      for (const id of ids) {
        const variant = getAchievementToastVariant(getUnlockableAchievement(id)!);
        expect(variant === "secret").toBe(secretIds.includes(id));
      }
    }
  });
});

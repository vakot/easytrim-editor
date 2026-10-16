import { Crown, HardDrive, Trophy } from "lucide-react";
import { beforeEach, describe, expect, it } from "vitest";

import { i18n } from "@/i18n/config";

import { createAchievementAnnouncement } from "../achievement-announcement.utils";

const t = i18n.t.bind(i18n);

describe("createAchievementAnnouncement", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("announces a tier with its series and tier", () => {
    expect(createAchievementAnnouncement(["data-cruncher-bronze"], t)).toEqual({
      achievementIds: ["data-cruncher-bronze"],
      description: "Bronze tier unlocked",
      icon: HardDrive,
      tier: "bronze",
      title: "Data Cruncher",
    });
  });

  it("collapses tiers of one series unlocked together into the highest tier", () => {
    expect(
      createAchievementAnnouncement(
        ["data-cruncher-bronze", "data-cruncher-gold", "data-cruncher-silver"],
        t,
      ),
    ).toMatchObject({
      achievementIds: ["data-cruncher-bronze", "data-cruncher-gold", "data-cruncher-silver"],
      description: "Gold tier unlocked",
      tier: "gold",
      title: "Data Cruncher",
    });
  });

  it("announces a standalone achievement without a tier", () => {
    expect(createAchievementAnnouncement(["the-chosen-one"], t)).toMatchObject({
      description: "Achievement unlocked",
      icon: Crown,
      tier: null,
      title: "The Chosen One",
    });
  });

  it("summarizes unlocks across several entries in one announcement", () => {
    expect(
      createAchievementAnnouncement(
        ["export-mastery-bronze", "export-mastery-silver", "gif-creator-bronze", "the-chosen-one"],
        t,
      ),
    ).toEqual({
      achievementIds: [
        "export-mastery-bronze",
        "export-mastery-silver",
        "gif-creator-bronze",
        "the-chosen-one",
      ],
      description: "Export Mastery Silver, GIF Creator Bronze, The Chosen One",
      icon: Trophy,
      tier: null,
      title: "4 achievements unlocked",
    });
  });

  it("announces a collector as a standalone secret once it is unlocked", () => {
    expect(createAchievementAnnouncement(["gold-collector"], t)).toMatchObject({
      description: "Achievement unlocked",
      tier: null,
      title: "Gold Collector",
    });
  });

  it("summarizes a final tier together with the collector it completes", () => {
    expect(
      createAchievementAnnouncement(["storage-saver-bronze", "bronze-collector"], t),
    ).toMatchObject({
      achievementIds: ["storage-saver-bronze", "bronze-collector"],
      description: "Storage Saver Bronze, Bronze Collector",
      tier: null,
      title: "2 achievements unlocked",
    });
  });

  it("announces nothing for unknown achievements", () => {
    expect(createAchievementAnnouncement(["first-export"], t)).toBeNull();
    expect(createAchievementAnnouncement([], t)).toBeNull();
  });
});

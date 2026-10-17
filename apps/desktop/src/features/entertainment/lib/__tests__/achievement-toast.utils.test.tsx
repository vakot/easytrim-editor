import { beforeEach, describe, expect, it, vi } from "vitest";

import { i18n } from "@/i18n/config";

import { createAchievementAnnouncements } from "../achievement-announcements.utils";
import { presentAchievementToast } from "../achievement-toast.utils";

const sonner = vi.hoisted(() => ({ custom: vi.fn(), dismiss: vi.fn() }));

vi.mock("sonner", () => ({ toast: sonner }));

describe("presentAchievementToast", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
    vi.resetAllMocks();
  });

  it("shows a custom Sonner toast that closes on its own timer and reports every way it closes", () => {
    const [announcement] = createAchievementAnnouncements(["gold-collector"], i18n.t.bind(i18n));
    const onClosed = vi.fn();

    presentAchievementToast(announcement!, { displayMs: 9_000, onClosed, reducedMotion: true });

    expect(sonner.custom).toHaveBeenCalledWith(expect.any(Function), {
      className: "w-(--width)",
      duration: 9_000,
      id: "achievement-unlocked:gold-collector",
      onAutoClose: onClosed,
      onDismiss: onClosed,
    });
    const rendered = (sonner.custom.mock.calls[0]![0] as () => { props: unknown })();
    expect(rendered.props).toEqual({ announcement, reducedMotion: true });
  });

  it("returns a function that dismisses exactly that toast", () => {
    const [announcement] = createAchievementAnnouncements(["fine-tuning"], i18n.t.bind(i18n));

    const close = presentAchievementToast(announcement!, {
      displayMs: 4_500,
      onClosed: vi.fn(),
      reducedMotion: false,
    });

    expect(sonner.dismiss).not.toHaveBeenCalled();
    close();

    expect(sonner.dismiss).toHaveBeenCalledWith("achievement-unlocked:fine-tuning");
  });
});

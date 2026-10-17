import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { i18n } from "@/i18n/config";

import {
  achievementToastPresentation,
  secretRevealTimeline,
} from "../../consts/achievement-toast.consts";
import { createAchievementAnnouncements } from "../../lib/achievement-announcements.utils";
import type { AchievementAnnouncement } from "../../types/achievement-toast.types";
import { AchievementUnlockToast } from "../AchievementUnlockToast";

type RevealDriver = {
  onComplete: () => void;
  onUpdate: (elapsed: number) => void;
  stop: ReturnType<typeof vi.fn>;
  total: number;
};

const motion = vi.hoisted(() => ({
  bursts: [] as { cancel: ReturnType<typeof vi.fn> }[],
  drivers: [] as RevealDriver[],
  reduceMotion: false,
}));

vi.mock("motion/react", () => ({
  animate: vi.fn((from: unknown, ...rest: unknown[]) => {
    // Text reveals animate a number; confetti particles animate an element.
    if (typeof from === "number") {
      const [total, options] = rest as [
        number,
        { onComplete: () => void; onUpdate: (elapsed: number) => void },
      ];

      const driver = { ...options, stop: vi.fn(), total };
      motion.drivers.push(driver);
      return driver;
    }
    const burst = { cancel: vi.fn(), then: () => new Promise<void>(() => undefined) };
    motion.bursts.push(burst);
    return burst;
  }),
  useReducedMotion: () => motion.reduceMotion,
}));

const t = i18n.t.bind(i18n);

function announce(id: string): AchievementAnnouncement {
  return createAchievementAnnouncements([id], t)[0]!;
}

const variants = {
  bronze: "gif-creator-bronze",
  gold: "storage-saver-gold",
  secret: "the-chosen-one",
  silver: "audio-specialist-silver",
  standard: "fine-tuning",
} as const;

function particles(container: HTMLElement) {
  return container.querySelectorAll("[data-slot='confetti'] > span");
}

function toastRoot(container: HTMLElement) {
  return container.querySelector<HTMLElement>("[data-slot='achievement-unlock-toast']")!;
}

describe("AchievementUnlockToast", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
    motion.bursts = [];
    motion.drivers = [];
    motion.reduceMotion = false;
  });

  afterEach(() => {
    document.documentElement.style.fontSize = "";
  });

  it("shows the achievement icon, name, description, and caption", () => {
    const announcement = announce(variants.standard);
    const { container } = render(<AchievementUnlockToast announcement={announcement} />);

    expect(screen.getByText("Achievement unlocked")).toBeInTheDocument();
    expect(screen.getByText("Fine Tuning")).toBeInTheDocument();
    expect(screen.getByText(announcement.description)).toBeInTheDocument();
    expect(container.querySelector("svg")).not.toBeNull();
    expect(screen.queryByText("Bronze")).not.toBeInTheDocument();
  });

  it.each([
    ["bronze", "Bronze"],
    ["silver", "Silver"],
    ["gold", "Gold"],
  ] as const)("shows the %s tier and uses its theme color tokens", (variant, label) => {
    const { container } = render(
      <AchievementUnlockToast announcement={announce(variants[variant])} />,
    );

    const ribbon = container.querySelector<HTMLElement>("[data-slot='achievement-tier-ribbon']");

    expect(ribbon).toBeInTheDocument();
    expect(ribbon).toHaveTextContent(label);
    expect(ribbon).toHaveClass("rotate-45", "flex", "items-center", "justify-center", "border");
    expect(toastRoot(container)).toHaveAttribute("data-variant", variant);
    expect(toastRoot(container)).toHaveClass(`border-achievement-${variant}/60`);
    expect(container.querySelector("[data-slot='achievement-unlock-toast-surface']")).toHaveClass(
      `bg-achievement-${variant}/15`,
    );
    expect(ribbon).toHaveClass(`text-achievement-${variant}`);
  });

  it("keeps the default themed surface for a standard achievement", () => {
    const { container } = render(
      <AchievementUnlockToast announcement={announce(variants.standard)} />,
    );

    expect(toastRoot(container)).toHaveAttribute("data-variant", "standard");
    expect(toastRoot(container)).toHaveClass("bg-popover");
    expect(toastRoot(container).className).not.toMatch(/achievement-/);
    expect(container.querySelector("[data-slot='achievement-unlock-toast-surface']")).toBeNull();
    expect(container.querySelector("[data-slot='achievement-tier-ribbon']")).toBeNull();
  });

  it.each([
    ["standard", 18],
    ["bronze", 18],
    ["silver", 44],
    ["gold", 96],
    ["secret", 96],
  ] as const)("bursts confetti for %s with %i particles", (variant, count) => {
    const { container } = render(
      <AchievementUnlockToast announcement={announce(variants[variant])} />,
    );

    expect(particles(container)).toHaveLength(count);
  });

  it("raises the confetti intensity with the tier", () => {
    const counts = (["standard", "bronze", "silver", "gold", "secret"] as const).map((variant) => {
      const { container, unmount } = render(
        <AchievementUnlockToast announcement={announce(variants[variant])} />,
      );

      const count = particles(container).length;
      unmount();
      return count;
    });

    expect(counts).toEqual([...counts].sort((a, b) => a - b));
    expect(achievementToastPresentation.gold.confetti).toBe("celebration");
  });

  it("bursts once when it appears and not again on re-render", () => {
    const announcement = announce(variants.gold);
    const { container, rerender } = render(<AchievementUnlockToast announcement={announcement} />);
    rerender(<AchievementUnlockToast announcement={{ ...announcement }} />);

    expect(particles(container)).toHaveLength(96);
    expect(motion.bursts).toHaveLength(96);
  });

  it("cancels its animations when it unmounts", () => {
    const { container, unmount } = render(
      <AchievementUnlockToast announcement={announce(variants.secret)} />,
    );

    const layer = container.querySelector("[data-slot='confetti']")!;
    const bursts = [...motion.bursts];
    const drivers = [...motion.drivers];

    unmount();

    expect(bursts.every((burst) => burst.cancel.mock.calls.length === 1)).toBe(true);
    expect(drivers.length).toBeGreaterThan(0);
    expect(drivers.every((driver) => driver.stop.mock.calls.length === 1)).toBe(true);
    expect(layer.childElementCount).toBe(0);
  });

  describe("secret", () => {
    it("shows a red diagonal TOP SECRET ribbon only for secret achievements", () => {
      const secret = render(<AchievementUnlockToast announcement={announce(variants.secret)} />);
      const ribbon = secret.container.querySelector<HTMLElement>(
        "[data-slot='achievement-secret-ribbon']",
      )!;

      const label = screen.getByText("TOP SECRET");

      expect(ribbon).toHaveClass(
        "rotate-45",
        "flex",
        "h-5",
        "w-32",
        "items-center",
        "justify-center",
        "px-3",
        "bg-red-700",
        "text-white",
        "text-center",
      );
      expect(ribbon).toBe(label);
      expect(ribbon.parentElement).toHaveClass(
        "pointer-events-none",
        "absolute",
        "top-0",
        "right-0",
      );
      expect(secret.container.querySelector("[data-slot='achievement-unlock-title']")).toHaveClass(
        "pr-4",
      );
      expect(
        secret.container.querySelector("[data-slot='achievement-unlock-description']"),
      ).not.toHaveClass("pr-4", "pr-8", "pr-12");
      expect(secret.container.querySelector(".grid.min-w-0.flex-1")).not.toHaveClass("pr-12");
      secret.unmount();

      for (const variant of ["standard", "bronze", "silver", "gold"] as const) {
        const other = render(<AchievementUnlockToast announcement={announce(variants[variant])} />);

        expect(other.queryByText("TOP SECRET")).toBeNull();
        other.unmount();
      }
    });

    it("reveals the title before the description from Galactic Glyphs", () => {
      const announcement = announce(variants.secret);
      const { container } = render(<AchievementUnlockToast announcement={announcement} />);
      const [title, description] = motion.drivers;
      const states = (slot: string) =>
        [...container.querySelectorAll(`[data-slot='${slot}'] [data-slot='text-reveal-char']`)].map(
          (character) => (character as HTMLElement).dataset.resolved,
        );

      expect(motion.drivers).toHaveLength(2);
      expect(title!.total).toBeCloseTo(
        secretRevealTimeline.titleResolveStart + secretRevealTimeline.titleResolveDuration,
      );
      expect(states("achievement-unlock-title").every((state) => state === "false")).toBe(true);
      expect(states("achievement-unlock-description").every((state) => state === "false")).toBe(
        true,
      );

      act(() => {
        title!.onUpdate(
          secretRevealTimeline.titleResolveStart + secretRevealTimeline.titleResolveDuration,
        );
        title!.onComplete();
      });
      expect(states("achievement-unlock-title").every((state) => state === "true")).toBe(true);
      expect(states("achievement-unlock-description").every((state) => state === "false")).toBe(
        true,
      );

      act(() => description!.onComplete());
      expect(states("achievement-unlock-description").every((state) => state === "true")).toBe(
        true,
      );
    });

    it("starts its description only after its title has finished resolving", () => {
      expect(secretRevealTimeline.descriptionResolveStart).toBeGreaterThanOrEqual(
        secretRevealTimeline.titleResolveStart + secretRevealTimeline.titleResolveDuration,
      );
    });

    it("keeps the real text readable by assistive technology throughout the reveal", () => {
      const announcement = announce(variants.secret);
      const { container } = render(<AchievementUnlockToast announcement={announcement} />);

      expect(screen.getByText(announcement.title, { selector: ".sr-only" })).toBeInTheDocument();
      expect(
        screen.getByText(announcement.description, { selector: ".sr-only" }),
      ).toBeInTheDocument();
      const animated = container.querySelectorAll("[data-slot='text-reveal'] [aria-hidden='true']");
      expect(animated).toHaveLength(2);
    });

    it("restores the exact text once the reveal completes", () => {
      const announcement = announce(variants.secret);
      const { container } = render(<AchievementUnlockToast announcement={announcement} />);

      act(() => {
        for (const driver of motion.drivers) driver.onComplete();
      });

      const text = (slot: string) =>
        container.querySelector(`[data-slot='${slot}'] [aria-hidden='true']`)?.textContent;

      expect(text("achievement-unlock-title")).toBe(announcement.title);
      expect(text("achievement-unlock-description")).toBe(announcement.description);
    });

    it("restores localized non-Latin text exactly", async () => {
      await i18n.changeLanguage("ru");
      const russian = announce(variants.secret);
      const { container } = render(
        <AchievementUnlockToast
          announcement={{
            ...russian,
            description: "日本語のテキスト 🎬 é",
            title: "Мастер экспорта",
          }}
        />,
      );

      act(() => {
        for (const driver of motion.drivers) driver.onComplete();
      });

      expect(
        container.querySelector("[data-slot='achievement-unlock-title'] [aria-hidden='true']")
          ?.textContent,
      ).toBe("Мастер экспорта");
      expect(
        container.querySelector("[data-slot='achievement-unlock-description'] [aria-hidden='true']")
          ?.textContent,
      ).toBe("日本語のテキスト 🎬 é");
    });

    it("uses the shared secret styling with an iridescent icon stroke", () => {
      const { container } = render(
        <AchievementUnlockToast announcement={announce(variants.secret)} />,
      );

      expect(toastRoot(container)).toHaveAttribute("data-secret-state", "unlocked");
      expect(toastRoot(container).style.getPropertyValue("--secret-icon-stroke")).toMatch(
        /^url\(#achievement-secret-/,
      );
      expect(container.querySelectorAll("linearGradient stop")).toHaveLength(4);
    });
  });

  it("does not run any text reveal for non-secret achievements", () => {
    render(<AchievementUnlockToast announcement={announce(variants.gold)} />);

    expect(motion.drivers).toHaveLength(0);
  });

  describe("reduced motion", () => {
    it("still shows the announcement but skips confetti, the reveal, and css animation", () => {
      motion.reduceMotion = true;
      const announcement = announce(variants.secret);
      const { container } = render(<AchievementUnlockToast announcement={announcement} />);

      expect(toastRoot(container)).toHaveAttribute("data-reduced-motion", "true");
      expect(particles(container)).toHaveLength(0);
      expect(motion.drivers).toHaveLength(0);
      expect(
        container.querySelector("[data-slot='achievement-unlock-title'] [aria-hidden='true']")
          ?.textContent,
      ).toBe(announcement.title);
      expect(screen.getByText(announcement.title, { selector: ".sr-only" })).toBeInTheDocument();
    });

    it("lets an explicit setting force reduced motion but never overrides the system preference", () => {
      const forced = render(
        <AchievementUnlockToast announcement={announce(variants.gold)} reducedMotion />,
      );

      expect(toastRoot(forced.container)).toHaveAttribute("data-reduced-motion", "true");
      expect(particles(forced.container)).toHaveLength(0);
      forced.unmount();

      motion.reduceMotion = true;
      const system = render(
        <AchievementUnlockToast announcement={announce(variants.gold)} reducedMotion={false} />,
      );

      expect(toastRoot(system.container)).toHaveAttribute("data-reduced-motion", "true");
      expect(particles(system.container)).toHaveLength(0);
    });
  });

  describe("UI scaling", () => {
    it.each(["8px", "16px", "32px"])(
      "uses only scalable units at a %s root font size",
      (rootSize) => {
        document.documentElement.style.fontSize = rootSize;
        const { container } = render(
          <AchievementUnlockToast announcement={announce(variants.secret)} />,
        );

        const everything = [...container.querySelectorAll<HTMLElement>("*")];
        const inline = everything.map((element) => element.getAttribute("style") ?? "").join(" ");
        const classes = everything.map((element) => element.getAttribute("class") ?? "").join(" ");
        expect(inline).not.toMatch(/\d(?:\.\d+)?px/);
        expect(classes).not.toMatch(/\[-?\d+(?:\.\d+)?px\]/);
        expect(
          [...particles(container)].every((particle) =>
            (particle as HTMLElement).style.width.endsWith("rem"),
          ),
        ).toBe(true);
      },
    );
  });
});

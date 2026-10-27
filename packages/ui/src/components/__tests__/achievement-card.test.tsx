import { render, screen } from "@testing-library/react";
import { Crop } from "lucide-react";
import { describe, expect, it } from "vitest";

import { AchievementCard } from "../achievement-card";

function card(container: HTMLElement) {
  return container.querySelector<HTMLElement>("[data-slot='item']")!;
}

describe("AchievementCard", () => {
  it("shows an unlocked achievement with a success badge and its details", () => {
    const { container } = render(
      <AchievementCard
        description="Crop the frame to a new size"
        icon={Crop}
        status="Unlocked"
        title="Frame by Frame"
        unlocked
      >
        <p>Unlocked on May 4</p>
      </AchievementCard>,
    );

    expect(card(container)).toHaveAttribute("data-state", "unlocked");
    expect(card(container)).toHaveAttribute("role", "listitem");
    expect(screen.getByText("Frame by Frame")).toBeInTheDocument();
    expect(screen.getByText("Crop the frame to a new size")).toBeInTheDocument();
    expect(screen.getByText("Unlocked").closest("[data-slot='badge']")).toHaveAttribute(
      "data-variant",
      "success",
    );
    expect(screen.getByText("Unlocked on May 4")).toBeInTheDocument();
  });

  it("dims a locked achievement and omits the badge without a status", () => {
    const { container } = render(
      <AchievementCard description="Description" icon={Crop} title="Title" unlocked={false} />,
    );

    expect(card(container)).toHaveAttribute("data-state", "locked");
    expect(card(container)).toHaveClass("bg-muted/40");
    expect(container.querySelector("[data-slot='badge']")).toBeNull();
  });

  it("keeps the card surface for a locked onboarding card", () => {
    const { container } = render(
      <AchievementCard
        description="Description"
        icon={Crop}
        presentation="onboarding"
        title="Title"
        unlocked={false}
      />,
    );

    expect(card(container)).toHaveClass("bg-card");
    expect(card(container)).not.toHaveClass("bg-muted/40");
  });

  it("marks a new achievement visually and for screen readers", () => {
    const { container } = render(
      <AchievementCard
        description="Description"
        icon={Crop}
        newLabel="New"
        title="Title"
        unlocked
      />,
    );

    expect(screen.getByText("New")).toHaveClass("sr-only");
    expect(container.querySelector("[data-slot='achievement-new']")).not.toBeNull();
  });

  it("applies the iridescent treatment to an unlocked secret", () => {
    const { container } = render(
      <AchievementCard description="Description" icon={Crop} secret title="Title" unlocked />,
    );

    expect(card(container)).toHaveAttribute("data-secret", "true");
    expect(card(container)).toHaveAttribute("data-secret-state", "unlocked");
    expect(card(container).querySelector("svg defs linearGradient")).not.toBeNull();
    expect(card(container).style.getPropertyValue("--secret-icon-stroke")).toMatch(
      /^url\(#achievement-secret-/,
    );
  });
});

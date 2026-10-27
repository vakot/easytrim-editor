import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { LandingAchievements } from "../LandingAchievements";

function card() {
  return document.querySelector<HTMLElement>("[data-slot='item']")!;
}

function toast() {
  return document.querySelector<HTMLElement>("[data-slot='achievement-unlock-toast']");
}

describe("LandingAchievements", () => {
  it("starts with a locked achievement and no celebration", () => {
    render(<LandingAchievements />);

    expect(screen.getByRole("radio", { name: "Gold" })).toBeChecked();
    expect(card()).toHaveAttribute("data-state", "locked");
    expect(screen.getByText("Locked")).toBeInTheDocument();
    expect(toast()).toBeNull();
  });

  it("unlocks the card, plays its toast, and announces it", async () => {
    const user = userEvent.setup();
    render(<LandingAchievements />);

    await user.click(screen.getByRole("button", { name: "Unlock achievement" }));

    expect(card()).toHaveAttribute("data-state", "unlocked");
    expect(toast()).toHaveAttribute("data-variant", "gold");
    expect(screen.getByText("Achievement unlocked: Storage Saver")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Play again" })).toBeInTheDocument();
  });

  it("replays the celebration from the start", async () => {
    const user = userEvent.setup();
    render(<LandingAchievements />);

    await user.click(screen.getByRole("button", { name: "Unlock achievement" }));
    const first = toast();
    await user.click(screen.getByRole("button", { name: "Play again" }));

    expect(toast()).not.toBeNull();
    expect(toast()).not.toBe(first);
  });

  it("conceals a locked secret and reveals it once unlocked", async () => {
    const user = userEvent.setup();
    render(<LandingAchievements />);

    await user.click(screen.getByRole("radio", { name: "Secret" }));

    expect(card()).toHaveAttribute("data-secret-state", "locked");
    expect(screen.getByText("???")).toBeInTheDocument();
    expect(screen.queryByText("The Chosen One")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Unlock achievement" }));

    expect(card()).toHaveAttribute("data-secret-state", "unlocked");
    expect(toast()).toHaveAttribute("data-variant", "secret");
    expect(screen.getByText("Achievement unlocked: The Chosen One")).toBeInTheDocument();
  });

  it("locks the achievement again when another celebration is chosen", async () => {
    const user = userEvent.setup();
    render(<LandingAchievements />);

    await user.click(screen.getByRole("button", { name: "Unlock achievement" }));
    await user.click(screen.getByRole("radio", { name: "Bronze" }));

    expect(screen.getByRole("radio", { name: "Bronze" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Gold" })).not.toBeChecked();
    expect(card()).toHaveAttribute("data-state", "locked");
    expect(screen.getByText("GIF Creator")).toBeInTheDocument();
    expect(toast()).toBeNull();
  });
});

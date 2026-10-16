import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";

import { AppLayoutToolbar } from "../AppLayoutToolbar";

const mocks = vi.hoisted(() => ({
  executeCommand: vi.fn(),
  preload: vi.fn(),
}));

const commands = vi.hoisted(
  () =>
    ({
      "open-achievements": { attention: "New achievements", label: "Achievements" },
      "open-chapters": { label: "Manage chapters" },
      "open-settings": { label: "Settings" },
      "open-statistics": { label: "Statistics" },
      "open-workspace-view-activity": { label: "Activity Feed" },
      "open-workspace-view-exportQueue": { label: "Export Queue" },
      "open-workspace-view-sources": { label: "Sources" },
    }) as Record<string, { attention?: string; label: string }>,
);

vi.mock("@/app/hooks/useApplicationCommands", () => ({
  useApplicationCommand: (id: string) => ({
    enabled: true,
    icon: <svg data-testid={`icon-${id}`} />,
    id,
    pending: false,
    preload: mocks.preload,
    ...commands[id],
  }),
  useApplicationCommands: () => ({ executeCommand: mocks.executeCommand }),
}));

function renderToolbar() {
  return render(
    <TooltipProvider>
      <AppLayoutToolbar />
    </TooltipProvider>,
  );
}

describe("AppLayoutToolbar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    ["Sources", "open-workspace-view-sources"],
    ["Export Queue", "open-workspace-view-exportQueue"],
    ["Activity Feed", "open-workspace-view-activity"],
    ["Manage chapters", "open-chapters"],
    ["Settings", "open-settings"],
  ])("runs the %s command from the sidebar surface", (name, commandId) => {
    renderToolbar();

    fireEvent.click(screen.getByRole("button", { name }));

    expect(mocks.executeCommand).toHaveBeenCalledWith(commandId, "sidebar");
  });

  it("marks a command that asks for attention with a ping and announces why", () => {
    renderToolbar();

    const achievements = screen.getByRole("button", { name: "Achievements, New achievements" });
    expect(achievements.querySelector("[data-slot='attention']")).not.toBeNull();

    fireEvent.click(achievements);
    expect(mocks.executeCommand).toHaveBeenCalledWith("open-achievements", "sidebar");
    expect(
      screen.getByRole("button", { name: "Statistics" }).querySelector("[data-slot='attention']"),
    ).toBeNull();
  });

  it("renders each command icon and preloads on intent", () => {
    renderToolbar();

    expect(screen.getByTestId("icon-open-settings")).toBeInTheDocument();

    fireEvent.pointerEnter(screen.getByRole("button", { name: "Sources" }));
    expect(mocks.preload).toHaveBeenCalledTimes(1);
  });
});

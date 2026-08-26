import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  ResizableSection,
  ResizableSectionContent,
  ResizableSections,
  ResizableSectionTrigger,
} from "@/components/layout/ResizableSections";

function renderTestSections() {
  return render(
    <ResizableSections style={{ height: "600px" }}>
      <ResizableSection id="media" defaultSize="12rem" minSize="8rem">
        <ResizableSectionTrigger>Media details</ResizableSectionTrigger>
        <ResizableSectionContent>
          <button type="button" data-testid="media-action">
            Media action
          </button>
        </ResizableSectionContent>
      </ResizableSection>
      <ResizableSection id="imported" defaultSize="10rem" minSize="7rem">
        <ResizableSectionTrigger>Imported queue</ResizableSectionTrigger>
        <ResizableSectionContent>
          <button type="button" data-testid="imported-action">
            Imported action
          </button>
        </ResizableSectionContent>
      </ResizableSection>
      <ResizableSection id="export" defaultSize="16rem" minSize="8rem">
        <ResizableSectionTrigger>Export queue</ResizableSectionTrigger>
        <ResizableSectionContent>
          <button type="button" data-testid="export-action">
            Export action
          </button>
        </ResizableSectionContent>
      </ResizableSection>
    </ResizableSections>,
  );
}

describe("ResizableSections", () => {
  it("renders persistent triggers and an independent scroll area for every section", () => {
    renderTestSections();

    expect(screen.getByRole("button", { name: "Media details" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByRole("button", { name: "Imported queue" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export queue" })).toBeInTheDocument();
    expect(document.querySelectorAll('[data-slot="resizable-section-content"]')).toHaveLength(3);
    expect(screen.getByTestId("media-action")).toBeVisible();
    expect(screen.getByTestId("imported-action")).toBeVisible();
    expect(screen.getByTestId("export-action")).toBeVisible();
  });

  it("collapses only the requested section and keeps its trigger accessible", async () => {
    const user = userEvent.setup();
    renderTestSections();

    await user.click(screen.getByRole("button", { name: "Media details" }));

    expect(screen.getByRole("button", { name: "Media details" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.getByRole("button", { name: "Imported queue" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByRole("button", { name: "Export queue" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByRole("button", { name: "Media details" })).toBeVisible();
    expect(
      screen.getByTestId("media-action").closest('[data-slot="resizable-section-content"]'),
    ).toHaveAttribute("hidden");
  });

  it("supports keyboard activation and controlled open state", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <ResizableSections style={{ height: "300px" }}>
        <ResizableSection id="controlled" open onOpenChange={onOpenChange} defaultSize="12rem">
          <ResizableSectionTrigger>Controlled</ResizableSectionTrigger>
          <ResizableSectionContent>Content</ResizableSectionContent>
        </ResizableSection>
      </ResizableSections>,
    );

    screen.getByRole("button", { name: "Controlled" }).focus();
    await user.keyboard("{Enter}");
    expect(onOpenChange).toHaveBeenCalledWith(false);

    rerender(
      <ResizableSections style={{ height: "300px" }}>
        <ResizableSection
          id="controlled"
          open={false}
          onOpenChange={onOpenChange}
          defaultSize="12rem"
        >
          <ResizableSectionTrigger>Controlled</ResizableSectionTrigger>
          <ResizableSectionContent>Content</ResizableSectionContent>
        </ResizableSection>
      </ResizableSections>,
    );
    expect(screen.getByRole("button", { name: "Controlled" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(
      screen.getByText("Content").closest('[data-slot="resizable-section-content"]'),
    ).toHaveAttribute("hidden");
  });

  it("restores a valid expanded panel size after collapsing and reopening", async () => {
    const user = userEvent.setup();
    renderTestSections();
    const panel = screen.getByTestId("media");
    const initialPanelSize = panel.style.flexGrow;

    await user.click(screen.getByRole("button", { name: "Media details" }));
    expect(panel.style.flexGrow).toBe("0");
    await user.click(screen.getByRole("button", { name: "Media details" }));

    expect(panel).toHaveAttribute("data-panel");
    expect(panel.style.flexGrow).toBe(initialPanelSize);
    expect(panel.style.flexGrow).not.toBe("0");
    expect(screen.getByRole("button", { name: "Media details" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByTestId("media-action")).toBeVisible();
  });
});

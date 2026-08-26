import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { describe, expect, it, vi } from "vitest";

import { createAppStore } from "@/app/store/store";
import { TooltipProvider } from "@/components/ui/tooltip";

vi.mock("@/features/export", () => ({
  ExportQueue: () => <div data-testid="export-queue-content">Export content</div>,
}));
vi.mock("../ImportedQueue", () => ({
  ImportedQueue: () => <div data-testid="imported-queue-content">Imported content</div>,
}));
vi.mock("../MediaDetails", () => ({
  MediaDetails: () => <div data-testid="media-details-content">Media content</div>,
}));

import { SourceSidebar } from "../SourceSidebar";

describe("SourceSidebar", () => {
  it("renders three independently scrollable sections with sibling separators", () => {
    render(
      <Provider store={createAppStore()}>
        <TooltipProvider>
          <SourceSidebar />
        </TooltipProvider>
      </Provider>,
    );

    expect(screen.getByRole("button", { name: "Media details" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Imported queue" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export queue" })).toBeInTheDocument();
    expect(document.querySelectorAll('[data-slot="resizable-section-content"]')).toHaveLength(3);
    expect(screen.queryByTestId("export-queue-scroll")).not.toBeInTheDocument();
    expect(screen.getByTestId("media-details-content")).toBeInTheDocument();
    expect(screen.getByTestId("imported-queue-content")).toBeInTheDocument();
    expect(screen.getByTestId("export-queue-content")).toBeInTheDocument();

    const separators = screen.getAllByRole("separator");
    expect(separators).toHaveLength(2);
    for (const separator of separators) {
      expect(separator).toHaveAttribute("aria-orientation", "horizontal");
      expect(separator).toHaveAttribute("tabindex", "0");
      expect(separator).not.toHaveAttribute("aria-hidden");
      expect(separator.querySelector('[data-slot="separator"]')).toHaveClass(
        "top-1/2",
        "-translate-y-1/2",
      );
    }

    for (const id of ["media-details", "imported-queue", "export-queue"]) {
      const panel = screen.getByTestId(id);
      expect(panel).not.toHaveClass("overflow-auto", "overflow-scroll");
      expect(panel.querySelector('[data-slot="scroll-area-viewport"]')).toBeInTheDocument();
    }
  });

  it("does not collapse other sections when one trigger is activated", async () => {
    const user = userEvent.setup();
    render(
      <Provider store={createAppStore()}>
        <TooltipProvider>
          <SourceSidebar />
        </TooltipProvider>
      </Provider>,
    );

    await user.click(screen.getByRole("button", { name: "Imported queue" }));

    expect(screen.getByRole("button", { name: "Media details" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByRole("button", { name: "Imported queue" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.getByRole("button", { name: "Export queue" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(
      screen
        .getByTestId("imported-queue-content")
        .closest('[data-slot="resizable-section-content"]'),
    ).toHaveAttribute("hidden");
  });
});

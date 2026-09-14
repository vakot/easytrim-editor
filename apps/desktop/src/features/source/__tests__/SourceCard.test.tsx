import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";

import { SourceCard, type SourceCardLabels } from "../SourceCard";

const labels: SourceCardLabels = {
  actions: "Source actions",
  active: "Active source",
  close: "Close source",
  deleteSource: "Delete source file",
  imported: "Imported source",
  open: "Open",
  previewUnavailable: "Preview unavailable",
  reveal: "Reveal in file manager",
  restore: "Restore",
  restoreSource: "Restore source",
};

describe("SourceCard", () => {
  it("renders the source title, path, status, and variant", () => {
    render(
      <TooltipProvider>
        <SourceCard
          active
          displayName="holiday.mp4"
          id="source-1"
          labels={labels}
          onClose={vi.fn()}
          onDelete={vi.fn()}
          onOpen={vi.fn()}
          onRestore={vi.fn()}
          onReveal={vi.fn()}
          showRestore={false}
          sourcePath="C:/Media/holiday.mp4"
          status="ready"
          statusLabel="Ready"
          variant="default"
        />
      </TooltipProvider>,
    );

    const card = document.querySelector('[data-slot="card"]');
    expect(card).toHaveAttribute("data-variant", "default");
    expect(screen.getByText("holiday.mp4")).toBeInTheDocument();
    expect(screen.getByText("C:/Media/holiday.mp4")).toBeInTheDocument();
    expect(screen.getByText("Ready")).toBeInTheDocument();
    expect(screen.getByLabelText("Source actions: holiday.mp4")).toBeInTheDocument();
  });

  it("calls the open action from the preview and primary action", () => {
    const onOpen = vi.fn();

    render(
      <TooltipProvider>
        <SourceCard
          active={false}
          displayName="holiday.mp4"
          id="source-1"
          labels={labels}
          onClose={vi.fn()}
          onDelete={vi.fn()}
          onOpen={onOpen}
          onRestore={vi.fn()}
          onReveal={vi.fn()}
          showRestore={false}
          sourcePath="C:/Media/holiday.mp4"
          status="ready"
          statusLabel="Ready"
          variant="default"
        />
      </TooltipProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open: holiday.mp4" }));
    fireEvent.click(screen.getByRole("button", { name: /^Open$/ }));

    expect(onOpen).toHaveBeenCalledTimes(2);
  });
});

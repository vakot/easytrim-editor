import { render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { describe, expect, it } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";

import { createAppStore } from "@/app/store/store";

import { ExportActions } from "../ExportActions";

describe("ExportActions", () => {
  it("keeps both export routes visible while disabling them without a ready source", () => {
    render(
      <Provider store={createAppStore()}>
        <TooltipProvider>
          <ExportActions />
        </TooltipProvider>
      </Provider>,
    );

    expect(screen.getByRole("toolbar", { name: "Export actions" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save Lossless Cut" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Optimize & Export" })).toBeDisabled();
  });
});

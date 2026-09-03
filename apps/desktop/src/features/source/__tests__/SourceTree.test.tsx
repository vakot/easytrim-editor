import { render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { describe, expect, it } from "vitest";

import { createAppStore } from "@/app/store/store";

import { SourceTree } from "../SourceTree";

describe("SourceTree", () => {
  it("renders the Explorer empty state with file, folder, and drop actions", () => {
    render(
      <Provider store={createAppStore()}>
        <SourceTree />
      </Provider>,
    );

    expect(screen.getByRole("form", { name: "Explorer" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Open File/ })).toHaveTextContent("CtrlO");
    expect(screen.getByRole("button", { name: /Open Folder/ })).toHaveTextContent("CtrlK");
    expect(screen.getByText("Drag and drop videos here")).toBeInTheDocument();
    expect(screen.getByText("MP4 · MOV · MKV · WebM · AVI")).toBeInTheDocument();
  });
});

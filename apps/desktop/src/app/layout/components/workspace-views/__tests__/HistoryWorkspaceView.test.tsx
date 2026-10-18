import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  state: {
    workspaceHistory: {
      operations: Array.from({ length: 200 }, (_, index) => ({ id: `operation-${index}` })),
      position: 200,
    },
  },
}));

vi.mock("@/app/store/redux-hooks", () => ({
  useAppSelector: (selector: (state: typeof mocks.state) => unknown) => selector(mocks.state),
}));

vi.mock("@/features/history", () => ({
  WorkspaceHistory: () => <section aria-label="History" data-testid="history-list" />,
  WorkspaceHistoryNavigation: () => <div aria-label="History navigation" />,
}));

import { HistoryWorkspaceView } from "../HistoryWorkspaceView";

describe("HistoryWorkspaceView", () => {
  beforeEach(() => {
    mocks.state.workspaceHistory.operations = Array.from({ length: 200 }, (_, index) => ({
      id: `operation-${index}`,
    }));
    mocks.state.workspaceHistory.position = 200;
  });

  it("constrains a long history to the resizable panel and allows the list row to shrink", () => {
    render(<HistoryWorkspaceView />);

    expect(screen.getByText("200/200")).toBeInTheDocument();
    expect(screen.getByTestId("history-list").parentElement).toHaveClass(
      "flex",
      "size-full",
      "min-h-0",
      "min-w-0",
      "flex-1",
      "flex-col",
    );
  });
});

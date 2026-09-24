import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  dispatch: vi.fn(),
  source: {
    exportAttempts: [],
    id: "source-1",
    snapshot: { source: { displayName: "source.mp4", sourcePath: "C:/source.mp4" } },
    sourceAvailability: "available" as const,
  },
}));

vi.mock("@/app/store/redux-hooks", () => ({
  useAppDispatch: () => mocks.dispatch,
  useAppSelector: () => [mocks.source],
}));

import { useSourceDelete } from "../contexts/source-delete-context";
import { SourceDeleteProvider } from "../SourceDeleteProvider";

function DeleteRequestProbe() {
  const { requestSourceDelete } = useSourceDelete();

  return (
    <button onClick={() => requestSourceDelete({ sourceIds: [mocks.source.id] })} type="button">
      Request delete
    </button>
  );
}

describe("SourceDeleteProvider", () => {
  it("mounts one dialog host and clears a request when canceled", async () => {
    const user = userEvent.setup();
    render(
      <SourceDeleteProvider>
        <DeleteRequestProbe />
      </SourceDeleteProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Request delete" }));
    expect(screen.getAllByRole("alertdialog")).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("confirms deletion through the existing source delete thunk", async () => {
    mocks.dispatch.mockResolvedValue(null);
    render(
      <SourceDeleteProvider>
        <DeleteRequestProbe />
      </SourceDeleteProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Request delete" }));
    await userEvent.setup().click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(mocks.dispatch).toHaveBeenCalledWith(expect.any(Function)));
  });
});

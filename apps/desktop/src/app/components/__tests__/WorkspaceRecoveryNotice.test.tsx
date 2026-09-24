import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { beforeEach, describe, expect, it } from "vitest";

import { WorkspaceRecoveryNotice } from "@/app/components/WorkspaceRecoveryNotice";
import { createDefaultEditorSnapshot } from "@/app/store/integration/editor-snapshot";
import {
  createWorkspaceRecoveryBackup,
  getWorkspaceRecoveryCandidate,
  initializeWorkspaceRecovery,
} from "@/app/store/recovery/workspace-recovery";
import {
  editingInstanceClosed,
  editingInstancesAdded,
} from "@/app/store/slices/editing-instances-slice";
import { createAppStore } from "@/app/store/store";
import { SourceList } from "@/features/source";
import { firstSource } from "@/test/source.fixtures";

const CURRENT_KEY = "easytrim:workspace-recovery:current";

function instance(id: string) {
  return {
    exportAttempts: [],
    id,
    origin: "source-import" as const,
    snapshot: createDefaultEditorSnapshot(firstSource, false),
    sourceAvailability: "available" as const,
  };
}

function setup() {
  const crashed = createAppStore();
  crashed.dispatch(editingInstancesAdded([instance("previous")]));
  localStorage.setItem(
    CURRENT_KEY,
    JSON.stringify(createWorkspaceRecoveryBackup(crashed.getState(), { sessionId: "crashed" })),
  );
  const store = createAppStore();
  initializeWorkspaceRecovery(store, "current", true);
  return store;
}

beforeEach(() => {
  localStorage.clear();
});

describe("workspace recovery entry points", () => {
  it("dismisses only the startup notice and keeps the candidate", async () => {
    const user = userEvent.setup();
    const store = setup();
    render(
      <Provider store={store}>
        <WorkspaceRecoveryNotice />
        <SourceList>{() => <div />}</SourceList>
      </Provider>,
    );

    expect(screen.getByRole("status")).toHaveTextContent("EasyTrim didn't close normally");
    expect(screen.getByRole("button", { name: /Restore previous session/ })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Restore previous session/ })).toBeInTheDocument();
    expect(getWorkspaceRecoveryCandidate()?.sessionId).toBe("crashed");
  });

  it("shows the persistent empty-workspace action again after the current source closes", async () => {
    const store = setup();
    render(
      <Provider store={store}>
        <SourceList>{() => <div />}</SourceList>
      </Provider>,
    );

    expect(screen.getByRole("button", { name: /Restore previous session/ })).toBeInTheDocument();
    store.dispatch(editingInstancesAdded([instance("current")]));
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: /Restore previous session/ }),
      ).not.toBeInTheDocument(),
    );
    store.dispatch(editingInstanceClosed("current"));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Restore previous session/ })).toBeInTheDocument(),
    );
    expect(getWorkspaceRecoveryCandidate()?.sessionId).toBe("crashed");
  });
});

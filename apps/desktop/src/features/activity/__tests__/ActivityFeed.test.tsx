import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { describe, expect, it, vi } from "vitest";

import { ResizablePanelContextProvider } from "@/components/ui/resizable";
import { TooltipProvider } from "@/components/ui/tooltip";

import { activityFeedViewChanged } from "@/app/store/slices/preferences-slice";
import { createAppStore } from "@/app/store/store";

import type { ActivityEntry } from "../activity-projection";
import { ActivityFeedView } from "../ActivityFeed";

const session = {
  appVersion: "1.3.0",
  sessionId: "current-session",
  startedAt: "2026-08-31T08:00:00.000Z",
};

function renderActivity(
  entry: ActivityEntry,
  onAction = vi.fn(),
  activityFeedView: "default" | "compact" | "branch" = "default",
) {
  const store = createAppStore();
  store.dispatch(activityFeedViewChanged(activityFeedView));
  return render(
    <Provider store={store}>
      <TooltipProvider delayDuration={0}>
        <ResizablePanelContextProvider>
          <ActivityFeedView
            currentAppVersion="1.3.0"
            currentSessionId="current-session"
            entries={[entry]}
            now={Date.parse("2026-08-31T09:00:00.000Z")}
            onAction={onAction}
            sessions={[session]}
          />
        </ResizablePanelContextProvider>
      </TooltipProvider>
    </Provider>,
  );
}

function fileEntry(status: ActivityEntry["status"]): ActivityEntry {
  return {
    ...(status === "completed"
      ? {
          action: {
            kind: "restore" as const,
            path: "C:/Media/source.mp4",
            targetId: "source-1",
          },
        }
      : {}),
    id: "current-session:delete-1:source.file-delete",
    kind: "file-deleted",
    operationId: "delete-1",
    path: "C:/Media/source.mp4",
    sessionId: "current-session",
    startedAt: "2026-08-31T08:30:00.000Z",
    status,
    title: status === "pending" ? "Deleting file..." : `File deletion ${status}`,
  };
}

describe("ActivityFeedView file lifecycle entries", () => {
  it.each([
    ["files-imported", "Opened 1 file", "lucide-file-play"],
    ["folders-imported", "Opened 1 file from 1 folder", "lucide-folder-open"],
  ] as const)("uses the %s import marker icon", (kind, title, iconClass) => {
    const { container } = renderActivity({
      id: `current-session:import-${kind}`,
      kind,
      operationId: `import-${kind}`,
      sessionId: "current-session",
      startedAt: "2026-08-31T08:30:00.000Z",
      status: "completed",
      title,
    });

    expect(container.querySelector(`svg.${iconClass}`)).toBeInTheDocument();
  });

  it("shows localized local-only diagnostics privacy information beside the title", async () => {
    const user = userEvent.setup();
    renderActivity(fileEntry("pending"));

    const title = screen.getByRole("heading", { name: "Activity Feed" });
    const trigger = screen.getByRole("button", {
      name: "Activity history privacy information",
    });

    expect(title.parentElement).toHaveClass("mx-3", "flex", "items-center");
    expect(title.nextElementSibling).toBe(trigger);
    expect(trigger).toHaveClass("text-primary");

    await user.hover(trigger);

    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "Activity history is stored only on this device as part of local diagnostic logs. It is not uploaded or sent anywhere.",
    );
  });

  it("shows pending deletion without a restore action", () => {
    renderActivity(fileEntry("pending"));

    expect(screen.getByText("Deleting file...")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Restore" })).not.toBeInTheDocument();
  });

  it("renders a branch header and muted rows without repeating the path", () => {
    renderActivity(
      {
        id: "current-session:render-1:ffmpeg.export",
        kind: "render",
        path: "C:/Media/source.mp4",
        sessionId: "current-session",
        snapshotId: "snapshot-1",
        startedAt: "2026-08-31T08:30:00.000Z",
        status: "completed",
        title: "Render completed",
      },
      vi.fn(),
      "branch",
    );

    expect(screen.getByText("source.mp4")).toHaveClass("text-foreground");
    expect(screen.getAllByText("C:/Media/source.mp4")).toHaveLength(1);
    expect(screen.getByText("Render completed")).toHaveClass("text-muted-foreground");
    expect(screen.getByText("Render completed").closest('[data-slot="marker"]')).toHaveClass(
      "text-muted-foreground",
    );
    expect(document.querySelector("svg.lucide-git-branch")).toBeInTheDocument();
  });

  it("shows restore only after a completed deletion", async () => {
    const onAction = vi.fn();
    const user = userEvent.setup();
    renderActivity(fileEntry("completed"), onAction);

    await user.click(screen.getByRole("button", { name: "Restore" }));

    expect(onAction).toHaveBeenCalledWith({
      kind: "restore",
      path: "C:/Media/source.mp4",
      targetId: "source-1",
    });
  });

  it.each(["failed", "cancelled", "interrupted"] as const)(
    "keeps the restore action hidden for %s deletion",
    (status) => {
      renderActivity(fileEntry(status));

      expect(screen.queryByRole("button", { name: "Restore" })).not.toBeInTheDocument();
    },
  );
});

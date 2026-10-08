import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { describe, expect, it, vi } from "vitest";

const restoreSourceFromTrash = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock("@/lib/tauri/media", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tauri/media")>()),
  restoreSourceFromTrash,
}));

import { ResizablePanelContextProvider } from "@/components/ui/resizable";
import { TooltipProvider } from "@/components/ui/tooltip";

import { activityFeedViewChanged } from "@/app/store/slices/preferences-slice";
import { createAppStore } from "@/app/store/store";

import type { ActivityEntry } from "../../../lib/activity-projection";
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
  options: {
    additionalEntries?: ActivityEntry[];
    currentAppVersion?: string;
    currentSessionId?: string;
    sessions?: (typeof session)[];
  } = {},
) {
  const currentSessionId = options.currentSessionId ?? "current-session";
  const store = createAppStore();
  store.dispatch(activityFeedViewChanged(activityFeedView));
  return render(
    <Provider store={store}>
      <TooltipProvider delayDuration={0}>
        <ResizablePanelContextProvider>
          <ActivityFeedView
            currentAppVersion={options.currentAppVersion ?? "1.3.0"}
            currentSessionId={currentSessionId}
            entries={[entry, ...(options.additionalEntries ?? [])]}
            onAction={onAction}
            sessions={options.sessions ?? [session]}
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
  it("uses the shared elapsed-time labels for adjacent historical sessions", () => {
    vi.useFakeTimers();
    const now = new Date("2026-08-31T18:00:00.000Z");
    vi.setSystemTime(now);
    const sessionStarts = [
      new Date(now.getTime() - 23 * 60 * 60_000).toISOString(),
      new Date(now.getTime() - 24 * 60 * 60_000).toISOString(),
    ];

    const sessions = sessionStarts.map((startedAt, index) => ({
      ...session,
      sessionId: `history-session-${index}`,
      startedAt,
    }));

    const entries = sessionStarts.map((startedAt, index) => ({
      id: `history-session-${index}:delete-1:source.file-delete`,
      kind: "file-deleted" as const,
      operationId: `delete-${index}`,
      path: "C:/Media/source.mp4",
      sessionId: `history-session-${index}`,
      startedAt,
      status: "completed" as const,
      title: "File deleted",
    }));

    try {
      const { container } = renderActivity(entries[0]!, vi.fn(), "default", {
        additionalEntries: [entries[1]!],
        sessions,
      });

      const sessionLabels = Array.from(
        container.querySelectorAll('[data-slot="marker"][data-variant="separator"]'),
      ).map((separator) => separator.querySelector("time")?.textContent);

      expect(sessionLabels).toEqual(["23 hours ago", "yesterday"]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("renders an old session separator with a single date timestamp", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-31T18:00:00.000Z"));
    const startedAt = "2026-08-29T10:03:00.000Z";
    const oldSession = { ...session, appVersion: "1.4.2", sessionId: "old-session", startedAt };
    const expectedDate = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(
      new Date(startedAt),
    );

    try {
      renderActivity(
        {
          id: "old-session:delete-1:source.file-delete",
          kind: "file-deleted",
          operationId: "delete-1",
          path: "C:/Media/source.mp4",
          sessionId: "old-session",
          startedAt,
          status: "completed",
          title: "File deleted",
        },
        vi.fn(),
        "default",
        { currentSessionId: "current-session", sessions: [oldSession] },
      );

      const timestamp = screen.getAllByRole("time")[0]!;
      const separator = timestamp.closest('[data-slot="marker"]');
      expect(timestamp).toHaveTextContent(expectedDate);
      expect(separator?.textContent).toBe(`v1.4.2·${expectedDate}`);
      expect(separator?.querySelectorAll("time")).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("merges historical sessions that share the Yesterday display bucket", () => {
    vi.useFakeTimers();
    const now = new Date("2026-08-31T18:00:00.000Z");
    vi.setSystemTime(now);
    const sessionStarts = [
      new Date(now.getTime() - 24 * 60 * 60_000).toISOString(),
      new Date(now.getTime() - 30 * 60 * 60_000).toISOString(),
    ];

    const sessions = sessionStarts.map((startedAt, index) => ({
      ...session,
      sessionId: `yesterday-session-${index}`,
      startedAt,
    }));

    const entries = sessionStarts.map((startedAt, index) => ({
      id: `yesterday-session-${index}:delete-1:source.file-delete`,
      kind: "file-deleted" as const,
      operationId: `delete-${index}`,
      path: `C:/Media/source-${index}.mp4`,
      sessionId: `yesterday-session-${index}`,
      startedAt,
      status: "completed" as const,
      title: `Deleted source ${index}`,
    }));

    try {
      const { container } = renderActivity(entries[0]!, vi.fn(), "default", {
        additionalEntries: [entries[1]!],
        sessions,
      });

      const separators = container.querySelectorAll(
        '[data-slot="marker"][data-variant="separator"]',
      );

      expect(separators).toHaveLength(1);
      expect(separators[0]?.querySelector("time")).toHaveTextContent("yesterday");
      expect(screen.getAllByText(/Deleted source/).map((entry) => entry.textContent)).toEqual([
        "Deleted source 0",
        "Deleted source 1",
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("merges historical sessions that share an absolute-date display bucket", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-31T18:00:00.000Z"));
    const sessionStarts = ["2026-08-28T12:00:00.000Z", "2026-08-28T10:00:00.000Z"];
    const sessions = sessionStarts.map((startedAt, index) => ({
      ...session,
      sessionId: `dated-session-${index}`,
      startedAt,
    }));

    const entries = sessionStarts.map((startedAt, index) => ({
      id: `dated-session-${index}:delete-1:source.file-delete`,
      kind: "file-deleted" as const,
      operationId: `delete-${index}`,
      path: `C:/Media/source-${index}.mp4`,
      sessionId: `dated-session-${index}`,
      startedAt,
      status: "completed" as const,
      title: `Deleted source ${index}`,
    }));

    try {
      const { container } = renderActivity(entries[0]!, vi.fn(), "default", {
        additionalEntries: [entries[1]!],
        sessions,
      });

      const separators = container.querySelectorAll(
        '[data-slot="marker"][data-variant="separator"]',
      );

      const timestamps = Array.from(separators).map(
        (separator) => separator.querySelector("time")?.textContent,
      );

      expect(separators).toHaveLength(1);
      expect(timestamps).toEqual([
        new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(
          new Date(sessionStarts[0]!),
        ),
      ]);
      expect(screen.getByText("Deleted source 0")).toBeInTheDocument();
      expect(screen.getByText("Deleted source 1")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("updates display groups when a session crosses into an absolute-date bucket", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-31T17:59:59.000Z"));
    const sessionStarts = ["2026-08-29T18:00:00.000Z", "2026-08-29T17:59:59.000Z"];
    const sessions = sessionStarts.map((startedAt, index) => ({
      ...session,
      sessionId: `transition-session-${index}`,
      startedAt,
    }));

    const entries = sessionStarts.map((startedAt, index) => ({
      id: `transition-session-${index}:delete-1:source.file-delete`,
      kind: "file-deleted" as const,
      operationId: `delete-${index}`,
      path: `C:/Media/source-${index}.mp4`,
      sessionId: `transition-session-${index}`,
      startedAt,
      status: "completed" as const,
      title: `Deleted source ${index}`,
    }));

    try {
      const { container } = renderActivity(entries[0]!, vi.fn(), "default", {
        additionalEntries: [entries[1]!],
        sessions,
      });

      const separatorQuery = '[data-slot="marker"][data-variant="separator"]';

      expect(container.querySelectorAll(separatorQuery)).toHaveLength(2);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1_000);
      });
      expect(container.querySelectorAll(separatorQuery)).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps same-time-bucket sessions separate when version warning presentation differs", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-31T18:00:00.000Z"));
    const sessionStarts = ["2026-08-30T12:00:00.000Z", "2026-08-30T10:00:00.000Z"];
    const sessions = sessionStarts.map((startedAt, index) => ({
      ...session,
      appVersion: index === 0 ? "1.4.2" : "1.3.0",
      sessionId: `version-session-${index}`,
      startedAt,
    }));

    const entries = sessionStarts.map((startedAt, index) => ({
      id: `version-session-${index}:delete-1:source.file-delete`,
      kind: "file-deleted" as const,
      operationId: `delete-${index}`,
      path: `C:/Media/source-${index}.mp4`,
      sessionId: `version-session-${index}`,
      startedAt,
      status: "completed" as const,
      title: `Deleted source ${index}`,
    }));

    try {
      const { container } = renderActivity(entries[0]!, vi.fn(), "default", {
        additionalEntries: [entries[1]!],
        sessions,
      });

      const separators = Array.from(
        container.querySelectorAll('[data-slot="marker"][data-variant="separator"]'),
      );

      expect(separators).toHaveLength(2);
      expect(separators.map((separator) => separator.textContent)).toEqual([
        "v1.4.2·yesterday",
        "yesterday",
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps the current session separate as Now when historical sessions are merged", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-31T18:00:00.000Z"));
    const historicalStartedAt = "2026-08-30T12:00:00.000Z";
    const olderHistoricalStartedAt = "2026-08-30T10:00:00.000Z";
    const historicalSession = {
      ...session,
      sessionId: "history-session",
      startedAt: historicalStartedAt,
    };

    const olderHistoricalSession = {
      ...session,
      sessionId: "older-history-session",
      startedAt: olderHistoricalStartedAt,
    };

    const currentEntry = {
      ...fileEntry("completed"),
      id: "current-session:current-delete:source.file-delete",
      operationId: "current-delete",
      startedAt: "2026-08-31T17:00:00.000Z",
      title: "Current deletion",
    };

    const historicalEntry = {
      ...fileEntry("completed"),
      id: "history-session:history-delete:source.file-delete",
      operationId: "history-delete",
      sessionId: "history-session",
      startedAt: historicalStartedAt,
      title: "Historical deletion",
    };

    const olderHistoricalEntry = {
      ...historicalEntry,
      id: "older-history-session:older-delete:source.file-delete",
      operationId: "older-delete",
      sessionId: "older-history-session",
      startedAt: olderHistoricalStartedAt,
      title: "Older historical deletion",
    };

    try {
      const { container } = renderActivity(currentEntry, vi.fn(), "default", {
        additionalEntries: [historicalEntry, olderHistoricalEntry],
        sessions: [session, historicalSession, olderHistoricalSession],
      });

      const timestamps = Array.from(
        container.querySelectorAll('[data-slot="marker"][data-variant="separator"]'),
      ).map((separator) => separator.textContent?.replaceAll("·", "").trim());

      expect(timestamps).toEqual(["Now", "yesterday"]);
      expect(screen.getByText("Current deletion")).toBeInTheDocument();
      expect(screen.getByText("Historical deletion")).toBeInTheDocument();
      expect(screen.getByText("Older historical deletion")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

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

  it("shows pending deletion without a restore action", () => {
    renderActivity(fileEntry("pending"));

    expect(screen.getByText("Deleting file...")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Restore" })).not.toBeInTheDocument();
  });

  it.each([
    ["Lossless Cut", "fast-cut", "Lossless Cut completed"],
    ["Optimized Export", "render", "Optimized export completed"],
  ] as const)("offers the Open action for a completed %s", async (_label, kind, title) => {
    const onAction = vi.fn();
    const user = userEvent.setup();
    renderActivity(
      {
        action: { kind: "open", path: "C:/Exports/result.mp4" },
        id: `current-session:${kind}:ffmpeg.export`,
        kind,
        path: "C:/Exports/result.mp4",
        sessionId: "current-session",
        startedAt: "2026-08-31T08:30:00.000Z",
        status: "completed",
        title,
      },
      onAction,
    );

    await user.click(screen.getByRole("button", { name: "Open" }));

    expect(onAction).toHaveBeenCalledWith({
      kind: "open",
      path: "C:/Exports/result.mp4",
    });
  });

  it("renders a branch header and muted rows without repeating the path", () => {
    const { container } = renderActivity(
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
    expect(screen.getByText("Render completed").closest('[data-slot="marker-title"]')).toHaveClass(
      "text-muted-foreground",
    );
    expect(screen.getByText("Render completed").closest('[data-slot="marker"]')).toHaveClass(
      "text-muted-foreground",
    );
    expect(container.querySelector("svg.lucide-film")).toBeInTheDocument();
  });

  it("uses the shared restore action after a completed deletion", async () => {
    const onAction = vi.fn();
    const user = userEvent.setup();
    renderActivity(fileEntry("completed"), onAction);

    await user.click(screen.getByRole("button", { name: "Restore" }));

    expect(onAction).not.toHaveBeenCalled();
    expect(restoreSourceFromTrash).toHaveBeenCalledWith("C:/Media/source.mp4");
  });

  it.each(["failed", "cancelled", "interrupted"] as const)(
    "keeps the restore action hidden for %s deletion",
    (status) => {
      renderActivity(fileEntry(status));

      expect(screen.queryByRole("button", { name: "Restore" })).not.toBeInTheDocument();
    },
  );
});

import { createAction, createSlice } from "@reduxjs/toolkit";

import type {
  HistoryChange,
  HistoryData,
  HistoryMetadata,
  HistoryOperation,
} from "@/domain/workspace-history";

import type { RootState } from "../store";

interface WorkspaceHistoryState extends HistoryData {
  interaction: (HistoryMetadata & { changes: HistoryChange[]; role: "edit" }) | null;
  replaying: boolean;
}
const initialState: WorkspaceHistoryState = {
  version: 1,
  operations: [],
  position: 0,
  interaction: null,
  replaying: false,
};

const historyInteractionStarted = createAction<HistoryMetadata>(
  "workspaceHistory/interactionStarted",
);

const historyInteractionEnded = createAction("workspaceHistory/interactionEnded");
const historyChangesCaptured = createAction<{
  changes: HistoryChange[];
  metadata: HistoryMetadata;
}>("workspaceHistory/changesCaptured");

const historyReplayStarted = createAction("workspaceHistory/replayStarted");
const historyReplayFinished = createAction<{ position: number }>("workspaceHistory/replayFinished");
const workspaceHistorySlice = createSlice({
  name: "workspaceHistory",
  initialState,
  reducers: {},
  extraReducers: (builder) =>
    builder
      .addCase(historyInteractionStarted, (state, action) => {
        if (state.replaying || state.interaction) return;
        state.interaction = { ...action.payload, role: "edit", changes: [] };
      })
      .addCase(historyChangesCaptured, (state, action) => {
        if (state.replaying) return;
        const changes = state.interaction?.changes ?? [];
        const merged = [...changes];
        for (const change of action.payload.changes) {
          const current = merged.find(
            (item) =>
              item.field === change.field &&
              JSON.stringify(item.target) === JSON.stringify(change.target),
          );

          if (current) current.after = change.after;
          else merged.push(change);
        }
        if (state.interaction)
          state.interaction.changes = merged.filter(
            (item) => JSON.stringify(item.before) !== JSON.stringify(item.after),
          );
        else {
          const operation: HistoryOperation = {
            ...action.payload.metadata,
            kind: "state",
            role: "edit",
            changes: action.payload.changes,
          };

          if (!operation.changes.length) return;
          const previous = state.operations[state.position - 1];
          const mayCoalesce =
            previous?.kind === "state" &&
            previous.role === "edit" &&
            previous.label === operation.label &&
            operation.timestamp - previous.timestamp <= 500 &&
            operation.timestamp >= previous.timestamp &&
            (operation.label === "Adjust trim" ||
              operation.label === "Adjust chapter" ||
              operation.label === "Rotate video");

          if (mayCoalesce) {
            const changes = [...previous.changes];
            for (const change of operation.changes) {
              const existing = changes.find(
                (candidate) =>
                  candidate.field === change.field &&
                  candidate.target.kind === "instance" &&
                  change.target.kind === "instance" &&
                  candidate.target.instanceId === change.target.instanceId,
              );

              if (existing) existing.after = change.after;
              else changes.push(change);
            }
            operation.changes = changes.filter(
              (change) => JSON.stringify(change.before) !== JSON.stringify(change.after),
            );
            if (operation.changes.length) {
              state.operations[state.position - 1] = {
                ...previous,
                changes: operation.changes,
                timestamp: operation.timestamp,
              };
            } else {
              state.operations.splice(state.position - 1, 1);
              state.position -= 1;
            }
          } else {
            state.operations = [...state.operations.slice(0, state.position), operation];
            state.position = state.operations.length;
          }
          state.position = state.operations.length;
        }
      })
      .addCase(historyInteractionEnded, (state) => {
        if (state.replaying || !state.interaction) return;
        const { changes, ...metadata } = state.interaction;
        state.interaction = null;
        if (!changes.length) return;
        const operation: HistoryOperation = { ...metadata, kind: "state", role: "edit", changes };
        state.operations = [...state.operations.slice(0, state.position), operation];
        state.position = state.operations.length;
      })
      .addCase(historyReplayStarted, (state) => {
        state.replaying = true;
      })
      .addCase(historyReplayFinished, (state, action) => {
        state.position = action.payload.position;
        state.replaying = false;
      }),
});

const workspaceHistoryReducer = workspaceHistorySlice.reducer;
const selectWorkspaceHistory = (state: RootState): HistoryData => ({
  version: 1,
  operations: state.workspaceHistory.operations,
  position: state.workspaceHistory.position,
});

export {
  historyChangesCaptured,
  historyInteractionEnded,
  historyInteractionStarted,
  historyReplayFinished,
  historyReplayStarted,
  selectWorkspaceHistory,
  workspaceHistoryReducer,
};

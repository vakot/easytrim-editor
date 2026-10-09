import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { describe, expect, it } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";

import type { ApplicationCommandId } from "@/app/commands";
import type { ApplicationCommand } from "@/app/commands/core/application-command.types";
import { ApplicationCommandsContext } from "@/app/contexts/application-commands-context";
import { createDefaultEditorSnapshot } from "@/app/store/integration/editor-snapshot";
import {
  editingInstanceExportAttemptQueued,
  editingInstancesAdded,
} from "@/app/store/slices/editing-instances-slice";
import { createAppStore } from "@/app/store/store";
import { createExportAttempt } from "@/domain/editing-instance";
import { firstSource } from "@/test/source.fixtures";

import { ExportActions } from "../ExportActions";

const exportCommands = [
  {
    enabled: false,
    group: { id: "export", label: "Export" },
    icon: null,
    id: "audio-export",
    label: "Audio Export",
    pending: false,
    searchTerms: [],
    shortcut: { code: "KeyA", key: "A", modifier: "control", shift: true },
    variant: "default",
  },
  {
    enabled: false,
    group: { id: "export", label: "Export" },
    icon: null,
    id: "gif-export",
    label: "GIF Export",
    pending: false,
    searchTerms: [],
    shortcut: { code: "KeyG", key: "G", modifier: "control", shift: true },
    variant: "default",
  },
] satisfies ApplicationCommand<ApplicationCommandId>[];

function renderExportActions(store = createAppStore()) {
  const commandsById = Object.fromEntries(exportCommands.map((command) => [command.id, command]));
  return render(
    <Provider store={store}>
      <ApplicationCommandsContext.Provider
        value={{
          commands: exportCommands,
          commandsById: commandsById as unknown as Record<
            ApplicationCommandId,
            ApplicationCommand<ApplicationCommandId>
          >,
          executeCommand: async () => undefined,
        }}
      >
        <TooltipProvider>
          <ExportActions />
        </TooltipProvider>
      </ApplicationCommandsContext.Provider>
    </Provider>,
  );
}

describe("ExportActions", () => {
  it("keeps primary actions visible and groups disabled specialized exports in More", async () => {
    const user = userEvent.setup();
    renderExportActions();

    expect(screen.getByRole("toolbar", { name: "Export actions" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Fast Export" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Optimized Export" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Fast Export" })).toHaveAttribute(
      "aria-keyshortcuts",
      "Control+S",
    );
    expect(screen.getByRole("button", { name: "Optimized Export" })).toHaveAttribute(
      "aria-keyshortcuts",
      "Control+E",
    );
    expect(screen.queryByRole("button", { name: "Audio Export" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "GIF Export" })).not.toBeInTheDocument();

    const toolbarButtons = within(screen.getByRole("toolbar")).getAllByRole("button");
    expect(toolbarButtons[0]).toHaveAccessibleName(/Export Queue$/);
    expect(toolbarButtons[1]).toHaveAccessibleName("Fast Export");
    expect(toolbarButtons[2]).toHaveAccessibleName("Optimized Export");
    expect(toolbarButtons[3]).toHaveAccessibleName("More");

    await user.click(screen.getByRole("button", { name: "More" }));
    const audioExportItem = screen.getByRole("menuitem", { name: /Audio Export/ });
    const gifExportItem = screen.getByRole("menuitem", { name: /GIF Export/ });
    expect(audioExportItem).toHaveAttribute("aria-disabled", "true");
    expect(gifExportItem).toHaveAttribute("aria-disabled", "true");
    expect(audioExportItem).toHaveTextContent("CtrlShiftA");
    expect(gifExportItem).toHaveTextContent("CtrlShiftG");

    await user.hover(audioExportItem);
    const audioTooltip = await screen.findByRole("tooltip");
    expect(audioTooltip).toHaveTextContent("Select an audio track to export");
    expect(audioTooltip).toHaveAttribute("data-side", "left");
  });

  it("keeps the dialog footer stable and disables Start queue without queued work", async () => {
    const user = userEvent.setup();
    const store = createAppStore();
    renderExportActions(store);

    await user.click(screen.getByRole("button", { name: /Export Queue$/ }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    const stripMetadata = screen.getByRole("checkbox", {
      name: "Strip metadata and chapters from exports",
    });

    expect(stripMetadata).not.toBeChecked();
    await user.click(stripMetadata);
    expect(store.getState().preferences.stripMetadataOnExport).toBe(true);
    expect(screen.getByRole("button", { name: "Start queue" })).toBeDisabled();
    expect(
      within(screen.getByRole("dialog")).getAllByRole("button", { name: "Close" }),
    ).toHaveLength(2);
    expect(screen.getByRole("dialog")).toHaveClass("max-h-[min(80dvh,48rem)]");
  });

  it("enables Start queue when queued work exists", async () => {
    const user = userEvent.setup();
    const store = createAppStore();
    const snapshot = createDefaultEditorSnapshot(firstSource, false);
    const attempt = createExportAttempt({
      capturedAt: 1,
      id: "attempt-1",
      output: {
        displayName: "trimmed.mp4",
        displayPath: "C:/Exports/trimmed.mp4",
        outputId: "output-1",
      },
      request: {
        audioTracks: [],
        mergeAudio: false,
        rotationDegrees: 0,
        sourcePath: firstSource.sourcePath,
        trim: { endMicros: 1_000_000, startMicros: 0 },
      },
      route: "fast",
      snapshot,
    });

    store.dispatch(
      editingInstancesAdded([
        {
          exportAttempts: [],
          id: "source-1",
          origin: "source-import",
          snapshot,
          sourceAvailability: "available",
        },
      ]),
    );
    renderExportActions(store);

    const queueButton = screen.getByRole("button", { name: /Export Queue$/ });
    queueButton.focus();
    act(() => {
      store.dispatch(editingInstanceExportAttemptQueued({ attempt, id: "source-1" }));
    });

    expect(document.activeElement).toBe(queueButton);
    expect(queueButton).toHaveClass("max-2xl:size-auto");
    expect(queueButton).toHaveClass("max-2xl:px-2");
    expect(
      within(queueButton).getByText((_, element) => element?.textContent === "0/1").parentElement,
    ).toBe(queueButton);

    await user.click(screen.getByRole("button", { name: /Export Queue$/ }));

    expect(screen.getByRole("button", { name: "Start queue" })).not.toBeDisabled();
  });
});

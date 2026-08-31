import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { revealDiagnosticReport } = vi.hoisted(() => ({
  revealDiagnosticReport: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/lib/tauri/diagnostics", () => ({
  bootstrapNativeDiagnostics: vi.fn(() => Promise.resolve(null)),
  persistDiagnosticEvent: vi.fn(() => Promise.resolve()),
  recordUiHeartbeat: vi.fn(() => Promise.resolve()),
  revealDiagnosticReport,
}));

import { DiagnosticsRecoveryDialog } from "../DiagnosticsRecoveryDialog";

const recovery = {
  classification: "abnormal_shutdown" as const,
  reportId: "report-1",
  reportPath: "C:\\diagnostics\\report.log",
  sessionId: "session-1",
};

describe("DiagnosticsRecoveryDialog", () => {
  it("stays absent when startup has no recovery report", () => {
    render(<DiagnosticsRecoveryDialog recovery={null} />);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("shows abnormal shutdown recovery and reveals the selected report", async () => {
    render(<DiagnosticsRecoveryDialog recovery={recovery} />);

    expect(screen.getByRole("alertdialog")).toHaveTextContent(
      "EasyTrim did not shut down normally",
    );
    fireEvent.click(screen.getByRole("button", { name: "Show Report" }));

    await waitFor(() => expect(revealDiagnosticReport).toHaveBeenCalledWith(recovery));
  });
});

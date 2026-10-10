import type {
  EditingInstanceId,
  ExportAttempt,
  ExportSettings,
  InstanceOrigin,
} from "@/domain/editing-instance";
import type { EditorSnapshot } from "@/domain/editor-snapshot";

export interface WorkspaceRecoveryInstance {
  exportAttempts: ExportAttempt[];
  gifSettings?: ExportSettings;
  id: EditingInstanceId;
  importedAtMicros?: number;
  optimizedArguments?: string;
  optimizedSettings?: ExportSettings;
  origin: InstanceOrigin;
  snapshot: EditorSnapshot;
  sourceAvailability: "available" | "deleted" | "missing";
  sourceDurationMicros?: number;
}

export interface WorkspaceRecoveryBackup {
  activeInstanceId: EditingInstanceId | null;
  createdAt: string;
  id: string;
  instances: WorkspaceRecoveryInstance[];
  sessionId: string;
  updatedAt: string;
  version: 2;
}

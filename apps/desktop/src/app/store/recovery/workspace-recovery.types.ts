import type {
  EditingInstanceId,
  ExportAttempt,
  ExportSettings,
  InstanceOrigin,
} from "@/domain/editing-instance";
import type { EditorSnapshot } from "@/domain/editor-snapshot";

export interface WorkspaceRecoveryInstance {
  exportAttempts: ExportAttempt[];
  id: EditingInstanceId;
  importedAtMicros?: number;
  optimizedArguments?: string;
  optimizedSettings?: ExportSettings;
  origin: InstanceOrigin;
  snapshot: EditorSnapshot;
  sourceAvailability: "available" | "deleted" | "missing";
}

export interface WorkspaceRecoveryBackup {
  activeInstanceId: EditingInstanceId | null;
  createdAt: string;
  id: string;
  instances: WorkspaceRecoveryInstance[];
  sessionId: string;
  updatedAt: string;
  version: 1;
}

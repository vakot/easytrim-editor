import type { WorkspaceRecoveryBackup } from "./workspace-recovery.types";

const CURRENT_KEY = "easytrim:workspace-recovery:current";
const CANDIDATE_KEY = "easytrim:workspace-recovery:candidate";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isSnapshot(value: unknown): boolean {
  if (!isRecord(value) || !isRecord(value.source) || !isRecord(value.audio)) return false;
  if (
    typeof value.source.sourcePath !== "string" ||
    typeof value.source.displayName !== "string" ||
    !isRecord(value.audio.master) ||
    typeof value.audio.master.enabled !== "boolean" ||
    !isFiniteNumber(value.audio.master.volumePercent) ||
    typeof value.audio.mergeAudio !== "boolean" ||
    !Array.isArray(value.audio.tracks) ||
    !(
      value.crop === null ||
      (isRecord(value.crop) &&
        isFiniteNumber(value.crop.x) &&
        isFiniteNumber(value.crop.y) &&
        isFiniteNumber(value.crop.width) &&
        isFiniteNumber(value.crop.height))
    ) ||
    typeof value.flipHorizontal !== "boolean" ||
    typeof value.flipVertical !== "boolean" ||
    !isFiniteNumber(value.rotation)
  )
    return false;
  const trim = value.trim;
  return (
    isRecord(trim) &&
    (trim.kind === "full-source" ||
      (isFiniteNumber(trim.startMicros) &&
        isFiniteNumber(trim.endMicros) &&
        trim.startMicros >= 0 &&
        trim.endMicros >= trim.startMicros)) &&
    value.audio.tracks.every(
      (track) =>
        isRecord(track) &&
        typeof track.enabled === "boolean" &&
        Number.isSafeInteger(track.streamIndex) &&
        isFiniteNumber(track.volumePercent),
    )
  );
}

function isExportAttempt(value: unknown): boolean {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    !isFiniteNumber(value.capturedAt) ||
    (value.route !== "fast" && value.route !== "optimized") ||
    !isRecord(value.request) ||
    !isRecord(value.output) ||
    typeof value.output.displayName !== "string" ||
    typeof value.output.displayPath !== "string" ||
    typeof value.output.outputId !== "string" ||
    !isSnapshot(value.snapshot) ||
    !isRecord(value.metrics) ||
    !(value.metrics.durationMs === null || isFiniteNumber(value.metrics.durationMs)) ||
    !isFiniteNumber(value.metrics.progressPercent) ||
    !isRecord(value.state)
  )
    return false;
  const status = value.state.status;
  if (!(["queued", "rendering", "completed", "failed", "canceled"] as unknown[]).includes(status))
    return false;
  return (
    status !== "completed" ||
    (isRecord(value.state.result) &&
      typeof value.state.result.displayName === "string" &&
      typeof value.state.result.displayPath === "string" &&
      typeof value.state.result.operationId === "string")
  );
}

function isBackup(value: unknown): value is WorkspaceRecoveryBackup {
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    typeof value.id !== "string" ||
    typeof value.sessionId !== "string" ||
    typeof value.createdAt !== "string" ||
    typeof value.updatedAt !== "string" ||
    !(value.activeInstanceId === null || typeof value.activeInstanceId === "string") ||
    !Array.isArray(value.instances)
  )
    return false;

  const ids = new Set<string>();
  return value.instances.every(
    (instance) =>
      isRecord(instance) &&
      typeof instance.id === "string" &&
      !ids.has(instance.id) &&
      (ids.add(instance.id), true) &&
      (instance.origin === "source-import" || instance.origin === "duplicate") &&
      (instance.sourceAvailability === "available" ||
        instance.sourceAvailability === "deleted" ||
        instance.sourceAvailability === "missing") &&
      isSnapshot(instance.snapshot) &&
      (instance.importedAtMicros === undefined || isFiniteNumber(instance.importedAtMicros)) &&
      (instance.optimizedArguments === undefined ||
        typeof instance.optimizedArguments === "string") &&
      (instance.optimizedSettings === undefined ||
        (isRecord(instance.optimizedSettings) &&
          isRecord(instance.optimizedSettings.resolution) &&
          isFiniteNumber(instance.optimizedSettings.resolution.height) &&
          isFiniteNumber(instance.optimizedSettings.resolution.width) &&
          (instance.optimizedSettings.frameRate === undefined ||
            instance.optimizedSettings.frameRate === null ||
            isRecord(instance.optimizedSettings.frameRate)))) &&
      Array.isArray(instance.exportAttempts) &&
      instance.exportAttempts.every(isExportAttempt),
  );
}

function readBackup(key: string): WorkspaceRecoveryBackup | null {
  try {
    const serialized = localStorage.getItem(key);
    if (!serialized) return null;
    const value: unknown = JSON.parse(serialized);
    return isBackup(value) ? value : null;
  } catch {
    return null;
  }
}

function writeBackup(key: string, backup: WorkspaceRecoveryBackup): void {
  try {
    localStorage.setItem(key, JSON.stringify(backup));
  } catch (error: unknown) {
    console.warn("[workspace-recovery] Recovery data could not be saved", error);
  }
}

function readCurrentBackup(): WorkspaceRecoveryBackup | null {
  return readBackup(CURRENT_KEY);
}

function readRecoveryCandidate(): WorkspaceRecoveryBackup | null {
  return readBackup(CANDIDATE_KEY);
}

function writeCurrentBackup(backup: WorkspaceRecoveryBackup): void {
  writeBackup(CURRENT_KEY, backup);
}

function promoteCurrentBackupToCandidate(): WorkspaceRecoveryBackup | null {
  const current = readCurrentBackup();
  try {
    if (current?.instances.length) localStorage.setItem(CANDIDATE_KEY, JSON.stringify(current));
    else localStorage.removeItem(CANDIDATE_KEY);
  } catch (error: unknown) {
    console.warn("[workspace-recovery] Previous session could not be retained", error);
    return null;
  }
  return current?.instances.length ? current : null;
}

function clearWorkspaceRecovery(): void {
  try {
    localStorage.removeItem(CURRENT_KEY);
    localStorage.removeItem(CANDIDATE_KEY);
  } catch (error: unknown) {
    console.warn("[workspace-recovery] Recovery data could not be cleared", error);
  }
}

export {
  clearWorkspaceRecovery,
  promoteCurrentBackupToCandidate,
  readCurrentBackup,
  readRecoveryCandidate,
  writeCurrentBackup,
};

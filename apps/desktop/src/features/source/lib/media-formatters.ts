import type { BinaryCapability } from "@/lib/tauri/media";

export function capabilityError(
  label: string,
  capability: BinaryCapability,
  unavailableMessage: string,
): string | null {
  return capability.available ? null : `${label}: ${capability.error ?? unavailableMessage}`;
}

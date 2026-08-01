import { Badge } from "@/components/ui/badge";
import type { SessionState } from "@/app/session-state";
import { capabilityError } from "@/features/import-source/utils/media-formatters";

export function CapabilityStatus({ capabilities }: { capabilities: SessionState["capabilities"] }) {
  if (capabilities.status === "checking") {
    return (
      <Badge variant="outline" role="status" className="text-muted-foreground">
        Checking media tools…
      </Badge>
    );
  }

  if (capabilities.status === "failed") {
    return (
      <Badge variant="destructive" role="status">
        Media tool check failed
      </Badge>
    );
  }

  const missing = [
    capabilityError("FFmpeg", capabilities.value.ffmpeg),
    capabilityError("FFprobe", capabilities.value.ffprobe),
  ].filter((value): value is string => value !== null);

  if (missing.length === 0) {
    return (
      <Badge
        variant="outline"
        role="status"
        className="border-emerald-400/35 bg-emerald-400/8 text-emerald-300"
      >
        <span className="size-1.5 rounded-full bg-emerald-300" aria-hidden="true" />
        Media tools ready
      </Badge>
    );
  }

  const message = missing.join(" ");
  return (
    <Badge
      variant="destructive"
      role="status"
      aria-label={`Media tools unavailable. ${message}`}
      title={message}
    >
      Media tools unavailable
    </Badge>
  );
}

import { Badge } from "@/components/ui/badge";
import type { SessionState } from "@/app/session-state";
import { capabilityError } from "@/features/import-source/utils/media-formatters";
import { useTranslation } from "react-i18next";

export function CapabilityStatus({ capabilities }: { capabilities: SessionState["capabilities"] }) {
  const { t } = useTranslation();

  if (capabilities.status === "checking") {
    return (
      <Badge variant="outline" role="status" className="text-muted-foreground">
        {t("import.capabilities.checking")}
      </Badge>
    );
  }

  if (capabilities.status === "failed") {
    return (
      <Badge variant="destructive" role="status">
        {t("import.capabilities.failed")}
      </Badge>
    );
  }

  const missing = [
    capabilityError("FFmpeg", capabilities.value.ffmpeg, t("import.capabilities.missing")),
    capabilityError("FFprobe", capabilities.value.ffprobe, t("import.capabilities.missing")),
  ].filter((value): value is string => value !== null);

  if (missing.length === 0) {
    return (
      <Badge
        variant="outline"
        role="status"
        className="border-emerald-400/35 bg-emerald-400/8 text-emerald-300"
      >
        <span className="size-1.5 rounded-full bg-emerald-300" aria-hidden="true" />
        {t("import.capabilities.ready")}
      </Badge>
    );
  }

  const message = missing.join(" ");
  return (
    <Badge
      variant="destructive"
      role="status"
      aria-label={t("import.capabilities.unavailableLabel", { message })}
      title={message}
    >
      {t("import.capabilities.unavailable")}
    </Badge>
  );
}

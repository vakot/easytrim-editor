import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { useAppSelector } from "@/app/store/redux-hooks";
import { selectCapabilities } from "@/app/store/slices/source-slice";

import { capabilityError } from "./lib/media-formatters.utils";
import styles from "./SourceStatus.module.css";

function StatusDot({ tone }: { tone: "success" | "error" | "neutral" }) {
  const color =
    tone === "success" ? "bg-emerald-300" : tone === "error" ? "bg-red-400" : "bg-muted-foreground";

  return <span className={`size-1.5 rounded-full ${color}`} aria-hidden="true" />;
}

function CapabilityTooltip({ children, content }: { children: ReactNode; content: ReactNode }) {
  return (
    <Tooltip delayDuration={0}>
      <TooltipTrigger asChild>
        <span tabIndex={0} className="inline-flex">
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent
        sideOffset={6}
        className="max-w-[16rem] flex-col items-stretch gap-2 whitespace-normal"
      >
        {content}
      </TooltipContent>
    </Tooltip>
  );
}

export function SourceStatus() {
  const { t } = useTranslation();
  const capabilities = useAppSelector(selectCapabilities);

  if (capabilities.status === "checking") {
    return (
      <CapabilityTooltip content={t("import.capabilities.checkingDescription")}>
        <Badge variant="outline" role="status" className="text-muted-foreground">
          <StatusDot tone="neutral" />
          {t("import.capabilities.checking")}
        </Badge>
      </CapabilityTooltip>
    );
  }

  if (capabilities.status === "failed") {
    return (
      <CapabilityTooltip content={capabilities.error.message}>
        <Badge variant="destructive" role="status" className={styles.errorBadge}>
          <StatusDot tone="error" />
          {t("import.capabilities.failed")}
        </Badge>
      </CapabilityTooltip>
    );
  }

  const entries = [
    { label: "FFmpeg", capability: capabilities.value.ffmpeg },
    { label: "FFprobe", capability: capabilities.value.ffprobe },
  ];

  const missing = entries
    .map(({ label, capability }) =>
      capabilityError(label, capability, t("import.capabilities.missing")),
    )
    .filter((value): value is string => value !== null);

  const dependencyDetails = (
    <>
      <p>
        {t(
          missing.length === 0
            ? "import.capabilities.readyDescription"
            : "import.capabilities.unavailableDescription",
        )}
      </p>
      <ul className="grid gap-1">
        {entries.map(({ label, capability }) => (
          <li key={label} className={capability.available ? "text-emerald-300" : "text-red-400"}>
            <span className="inline-flex items-center gap-1.5">
              <StatusDot tone={capability.available ? "success" : "error"} />
              {label}:{" "}
              {t(
                capability.available
                  ? "import.capabilities.installed"
                  : "import.capabilities.missingStatus",
              )}
            </span>
            {!capability.available && capability.error ? (
              <span className="block pl-3.5 text-muted-foreground">{capability.error}</span>
            ) : null}
          </li>
        ))}
      </ul>
    </>
  );

  if (missing.length === 0) {
    return (
      <CapabilityTooltip content={dependencyDetails}>
        <Badge
          variant="outline"
          role="status"
          className="border-emerald-400/35 bg-emerald-400/8 text-emerald-300"
        >
          <StatusDot tone="success" />
          {t("import.capabilities.ready")}
        </Badge>
      </CapabilityTooltip>
    );
  }

  const message = missing.join(" ");
  return (
    <CapabilityTooltip content={dependencyDetails}>
      <Badge
        variant="destructive"
        role="status"
        aria-label={t("import.capabilities.unavailableLabel", { message })}
        className={styles.errorBadge}
      >
        <StatusDot tone="error" />
        {t("import.capabilities.unavailable")}
      </Badge>
    </CapabilityTooltip>
  );
}

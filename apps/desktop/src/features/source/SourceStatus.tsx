import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { useAppSelector } from "@/app/store/redux-hooks";
import { selectCapabilities } from "@/app/store/slices/source-slice";
import type { BinaryCapability } from "@/lib/tauri/media.types";

import styles from "./SourceStatus.module.css";

function capabilityError(
  label: string,
  capability: BinaryCapability,
  unavailableMessage: string,
): string | null {
  return capability.available ? null : `${label}: ${capability.error ?? unavailableMessage}`;
}

function StatusDot({ tone }: { tone: "success" | "error" | "neutral" }) {
  const color =
    tone === "success" ? "bg-emerald-300" : tone === "error" ? "bg-red-400" : "bg-muted-foreground";

  return <span aria-hidden="true" className={`size-1.5 rounded-full ${color}`} />;
}

function CapabilityTooltip({ children, content }: { children: ReactNode; content: ReactNode }) {
  return (
    <Tooltip delayDuration={0}>
      <TooltipTrigger asChild>
        <span className="inline-flex" tabIndex={0}>
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent
        className="max-w-[16rem] flex-col items-stretch gap-2 whitespace-normal"
        sideOffset={6}
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
        <Badge className="text-muted-foreground" role="status" variant="outline">
          <StatusDot tone="neutral" />
          {t("import.capabilities.checking")}
        </Badge>
      </CapabilityTooltip>
    );
  }

  if (capabilities.status === "failed") {
    return (
      <CapabilityTooltip content={capabilities.error.message}>
        <Badge className={styles.errorBadge} role="status" variant="destructive">
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
    .map(({ capability, label }) =>
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
        {entries.map(({ capability, label }) => (
          <li className={capability.available ? "text-emerald-300" : "text-red-400"} key={label}>
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
          className="border-emerald-400/35 bg-emerald-400/8 text-emerald-300"
          role="status"
          variant="outline"
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
        aria-label={t("import.capabilities.unavailableLabel", { message })}
        className={styles.errorBadge}
        role="status"
        variant="destructive"
      >
        <StatusDot tone="error" />
        {t("import.capabilities.unavailable")}
      </Badge>
    </CapabilityTooltip>
  );
}

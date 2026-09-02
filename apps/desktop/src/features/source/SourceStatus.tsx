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
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex" tabIndex={0}>
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent
        className="max-w-3xs flex-col items-stretch gap-2 whitespace-normal"
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
      <CapabilityTooltip content={t("source.messages.checkingTools")}>
        <Badge className="text-muted-foreground" role="status" variant="outline">
          <StatusDot tone="neutral" />
          {t("source.status.checkingTools")}
        </Badge>
      </CapabilityTooltip>
    );
  }

  if (capabilities.status === "failed") {
    return (
      <CapabilityTooltip content={capabilities.error.message}>
        <Badge className={styles.errorBadge} role="status" variant="destructive">
          <StatusDot tone="error" />
          {t("source.status.toolsFailed")}
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
      capabilityError(label, capability, t("source.messages.dependencyMissing")),
    )
    .filter((value): value is string => value !== null);

  const dependencyDescription =
    missing.length === 0 ? t("source.messages.toolsReady") : t("source.messages.toolsUnavailable");

  const dependencyDetails = (
    <>
      <p>{dependencyDescription}</p>
      <ul className="grid gap-1">
        {entries.map(({ capability, label }) => {
          const capabilityStatus = capability.available
            ? t("source.status.installed")
            : t("source.status.missing");

          return (
            <li className={capability.available ? "text-emerald-300" : "text-red-400"} key={label}>
              <span className="inline-flex items-center gap-1.5">
                <StatusDot tone={capability.available ? "success" : "error"} />
                {label}: {capabilityStatus}
              </span>
              {!capability.available && capability.error ? (
                <span className="block pl-3.5 text-muted-foreground">{capability.error}</span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </>
  );

  if (missing.length === 0) {
    return (
      <CapabilityTooltip content={dependencyDetails}>
        <Badge role="status" variant="success">
          <StatusDot tone="success" />
          {t("source.status.toolsReady")}
        </Badge>
      </CapabilityTooltip>
    );
  }

  const message = missing.join(" ");
  return (
    <CapabilityTooltip content={dependencyDetails}>
      <Badge
        aria-label={t("source.accessibility.toolsUnavailable", { message })}
        className={styles.errorBadge}
        role="status"
        variant="destructive"
      >
        <StatusDot tone="error" />
        {t("source.status.toolsUnavailable")}
      </Badge>
    </CapabilityTooltip>
  );
}

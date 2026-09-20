import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { cn } from "@/lib/class-names.utils";
import { formatDateTime, formatRelativeTime } from "@/lib/date-time.utils";
import { useRelativeTimeNow } from "@/lib/hooks/use-relative-time";

interface RelativeTimestampProps {
  className?: string;
  label?: ReactNode;
  timestamp: number | undefined;
}

function RelativeTimestamp({ className, label, timestamp }: RelativeTimestampProps) {
  const { i18n, t } = useTranslation();
  const unknownLabel = t("common.status.unknown");
  const now = useRelativeTimeNow();
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const relativeTime = formatRelativeTime(timestamp, locale, unknownLabel, now);
  const exactTime = formatDateTime(timestamp, locale, unknownLabel);
  const timestampMs = timestamp === undefined ? undefined : timestamp / 1_000;
  const parsedTimestamp = timestampMs === undefined ? undefined : new Date(timestampMs);
  const semanticDateTime =
    parsedTimestamp && !Number.isNaN(parsedTimestamp.getTime())
      ? parsedTimestamp.toISOString()
      : undefined;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <time
          className={cn("cursor-help truncate focus-visible:outline-none", className)}
          dateTime={semanticDateTime}
          tabIndex={0}
        >
          {relativeTime}
        </time>
      </TooltipTrigger>
      <TooltipContent>
        {label ? <>{label}: </> : null}
        {exactTime}
      </TooltipContent>
    </Tooltip>
  );
}

export { RelativeTimestamp, type RelativeTimestampProps };

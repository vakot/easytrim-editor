import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { cn } from "@/lib/class-names.utils";
import { formatDateTime, formatRelativeTime } from "@/lib/date-time.utils";
import { useRelativeTimeNow } from "@/lib/hooks/use-relative-time";

interface RelativeTimestampProps {
  className?: string;
  dateTime?: string;
  label?: ReactNode;
  timestampMicros: number | undefined;
  unknownLabel: string;
}

function RelativeTimestamp({
  className,
  dateTime,
  label,
  timestampMicros,
  unknownLabel,
}: RelativeTimestampProps) {
  const { i18n } = useTranslation();
  const now = useRelativeTimeNow();
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const relativeTime = formatRelativeTime(timestampMicros, locale, unknownLabel, now);
  const exactTime = formatDateTime(timestampMicros, locale, unknownLabel);
  const timestampMs = timestampMicros === undefined ? undefined : timestampMicros / 1_000;
  const parsedTimestamp = timestampMs === undefined ? undefined : new Date(timestampMs);
  const semanticDateTime =
    dateTime ??
    (parsedTimestamp && !Number.isNaN(parsedTimestamp.getTime())
      ? parsedTimestamp.toISOString()
      : undefined);

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

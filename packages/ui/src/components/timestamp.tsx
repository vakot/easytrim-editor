"use client";

import type { ReactNode } from "react";

import { useRelativeTimeNow } from "../hooks/use-relative-time";
import { cn } from "../lib/class-names.utils";
import { formatDateTime, formatRelativeTime } from "../lib/date-time.utils";

import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

interface TimestampProps {
  className?: string;
  label?: ReactNode;
  /** BCP 47 locale used for the relative value and the exact time in the tooltip. */
  locale: string;
  /** Microseconds since the Unix epoch. */
  timestamp: number | undefined;
  /** Shown instead of a time when the timestamp is unavailable or invalid. */
  unknownLabel: string;
}

function Timestamp({ className, label, locale, timestamp, unknownLabel }: TimestampProps) {
  const now = useRelativeTimeNow();
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
          className={cn("truncate focus-visible:outline-none", className)}
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

export { Timestamp, type TimestampProps };

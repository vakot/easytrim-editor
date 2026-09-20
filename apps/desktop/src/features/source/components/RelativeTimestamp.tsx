import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { cn } from "@/lib/class-names.utils";

import { useRelativeTimeNow } from "../hooks/use-relative-time";
import { formatDateTime, formatRelativeTime } from "../lib/media-formatters.utils";

interface RelativeTimestampProps {
  className?: string;
  label: ReactNode;
  timestampMicros: number | undefined;
  unknownLabel: string;
}

function RelativeTimestamp({
  className,
  label,
  timestampMicros,
  unknownLabel,
}: RelativeTimestampProps) {
  const { i18n } = useTranslation();
  const now = useRelativeTimeNow();
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const relativeTime = formatRelativeTime(timestampMicros, locale, unknownLabel, now);
  const exactTime = formatDateTime(timestampMicros, locale, unknownLabel);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn("cursor-help truncate focus-visible:outline-none", className)}
          tabIndex={0}
        >
          {relativeTime}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        {label}: {exactTime}
      </TooltipContent>
    </Tooltip>
  );
}

export { RelativeTimestamp, type RelativeTimestampProps };

"use client";

import { useTranslation } from "react-i18next";

import { Timestamp, type TimestampProps } from "@easytrim-editor/ui/timestamp";

type RelativeTimestampProps = Omit<TimestampProps, "locale" | "unknownLabel">;

/** Shared timestamp bound to the active application language. */
function RelativeTimestamp(props: RelativeTimestampProps) {
  const { i18n, t } = useTranslation();

  return (
    <Timestamp
      {...props}
      locale={i18n.resolvedLanguage ?? i18n.language}
      unknownLabel={t("common.unknown")}
    />
  );
}

export { RelativeTimestamp, type RelativeTimestampProps };

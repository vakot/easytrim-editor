import { useTranslation } from "react-i18next";

import { TimelineTools } from "./TimelineTools";

export function TimelineToolbar() {
  const { t } = useTranslation();

  return (
    <div
      aria-label={t("timeline.accessibility.tools")}
      className="flex w-full items-stretch"
      data-slot="timeline-toolbar"
      role="toolbar"
    >
      <TimelineTools />
    </div>
  );
}

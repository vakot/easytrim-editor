import { useTranslation } from "react-i18next";

import { TabsList, TabsTrigger } from "@/components/ui/tabs";

function SourceListTabs() {
  const { t } = useTranslation();

  return (
    <TabsList className="min-w-0 flex-1" defaultValue="none">
      <TabsTrigger value="none">{t("source.labels.groupByNone")}</TabsTrigger>
      <TabsTrigger value="folder">{t("source.labels.groupByFolder")}</TabsTrigger>
      <TabsTrigger value="time">{t("source.labels.groupByUpdatedAt")}</TabsTrigger>
      <TabsTrigger value="imported">{t("source.labels.groupByImportedAt")}</TabsTrigger>
    </TabsList>
  );
}

export { SourceListTabs };

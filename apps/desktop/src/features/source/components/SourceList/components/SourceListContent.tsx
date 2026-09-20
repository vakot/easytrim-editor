import { useTranslation } from "react-i18next";

import { TabsContent } from "@/components/ui/tabs";

import { useSourceListData } from "../contexts/SourceListContext";

import {
  SourceListFolder,
  SourceListImported,
  SourceListNone,
  SourceListTime,
} from "./SourceListGroups";

function SourceListContent() {
  const { search, sources } = useSourceListData();
  const { t } = useTranslation();

  if (search.trim() && sources.length === 0) {
    return (
      <div className="px-2 py-4 text-center text-sm text-muted-foreground" role="status">
        {t("source.messages.noSearchResults")}
      </div>
    );
  }

  return (
    <>
      <TabsContent value="none">
        <SourceListNone sources={sources} />
      </TabsContent>
      <TabsContent value="folder">
        <SourceListFolder sources={sources} />
      </TabsContent>
      <TabsContent value="time">
        <SourceListTime sources={sources} />
      </TabsContent>
      <TabsContent value="imported">
        <SourceListImported sources={sources} />
      </TabsContent>
    </>
  );
}

export { SourceListContent };

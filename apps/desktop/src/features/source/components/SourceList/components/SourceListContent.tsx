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
      <div className="text-center text-sm text-muted-foreground" role="status">
        {t("source.messages.noSearchResults")}
      </div>
    );
  }

  return (
    <>
      <TabsContent className="min-w-0" value="none">
        <SourceListNone sources={sources} />
      </TabsContent>
      <TabsContent className="min-w-0" value="folder">
        <SourceListFolder sources={sources} />
      </TabsContent>
      <TabsContent className="min-w-0" value="time">
        <SourceListTime sources={sources} />
      </TabsContent>
      <TabsContent className="min-w-0" value="imported">
        <SourceListImported sources={sources} />
      </TabsContent>
    </>
  );
}

export { SourceListContent };

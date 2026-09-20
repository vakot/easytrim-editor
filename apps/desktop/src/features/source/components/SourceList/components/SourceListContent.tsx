import { useTranslation } from "react-i18next";

import { TabsContent } from "@/components/ui/tabs";

import { InfiniteScroll } from "@/components/infinite-scroll";

import { useSourceListData } from "../contexts/SourceListContext";

import {
  SourceListFolder,
  SourceListImported,
  SourceListNone,
  SourceListTime,
} from "./SourceListGroups";

function SourceListContent() {
  const { hasMore, isLoading, next, search, sources, visibleSources } = useSourceListData();
  const { t } = useTranslation();

  if (search.trim() && sources.length === 0) {
    return (
      <div className="px-2 py-4 text-center text-sm text-muted-foreground" role="status">
        {t("source.messages.noSearchResults")}
      </div>
    );
  }

  return (
    <InfiniteScroll batchSize={3} hasMore={hasMore} isLoading={isLoading} next={next}>
      <TabsContent value="none">
        <SourceListNone sources={visibleSources} />
      </TabsContent>
      <TabsContent value="folder">
        <SourceListFolder sources={visibleSources} />
      </TabsContent>
      <TabsContent value="time">
        <SourceListTime sources={visibleSources} />
      </TabsContent>
      <TabsContent value="imported">
        <SourceListImported sources={visibleSources} />
      </TabsContent>
    </InfiniteScroll>
  );
}

export { SourceListContent };

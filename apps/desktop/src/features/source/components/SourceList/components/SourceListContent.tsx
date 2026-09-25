import { useTranslation } from "react-i18next";

import { TabsContent } from "@/components/ui/tabs";

import { InfiniteScroll } from "@/components/infinite-scroll";

import { useSourceListData } from "../contexts/SourceListContext";
import { SourceListThumbnailDemandProvider } from "../contexts/SourceListThumbnailDemandProvider";

import {
  SourceListFolder,
  SourceListImported,
  SourceListNone,
  SourceListTime,
} from "./SourceListGroups";

function SourceListContent() {
  const { hasMore, next, search, sources, visibleSources } = useSourceListData();
  const { t } = useTranslation();

  if (search.trim() && sources.length === 0) {
    return (
      <div className="text-center text-sm text-muted-foreground" role="status">
        {t("source.messages.noSearchResults")}
      </div>
    );
  }

  return (
    <SourceListThumbnailDemandProvider>
      <InfiniteScroll hasMore={hasMore} next={next}>
        <TabsContent className="min-w-0" value="none">
          <SourceListNone sources={visibleSources} />
        </TabsContent>
        <TabsContent className="min-w-0" value="folder">
          <SourceListFolder sources={visibleSources} />
        </TabsContent>
        <TabsContent className="min-w-0" value="time">
          <SourceListTime sources={visibleSources} />
        </TabsContent>
        <TabsContent className="min-w-0" value="imported">
          <SourceListImported sources={visibleSources} />
        </TabsContent>
      </InfiniteScroll>
    </SourceListThumbnailDemandProvider>
  );
}

export { SourceListContent };

import { AnimatePresence } from "motion/react";
import { useTranslation } from "react-i18next";

import { InfiniteScroll } from "@/components/infinite-scroll";
import type { EditingInstance } from "@/domain/editing-instance";

import { useSourceListData } from "../contexts/SourceListContext";

import { SourceListItem } from "./SourceListItem";

interface SourceListContentProps {
  className?: string;
}

function SourceListContent({ className }: SourceListContentProps) {
  const { hasMore, isLoading, next, search, sources, visibleSources } = useSourceListData();
  const { t } = useTranslation();

  if (search.trim() && sources.length === 0) {
    return (
      <div className="text-center text-sm text-muted-foreground" role="status">
        {t("source.messages.noSearchResults")}
      </div>
    );
  }

  return (
    <InfiniteScroll className={className} hasMore={hasMore} isLoading={isLoading} next={next}>
      <SourceListItems sources={visibleSources} />
    </InfiniteScroll>
  );
}

function SourceListItems({ sources }: { sources: EditingInstance[] }) {
  const { matchesBySourceId } = useSourceListData();

  return (
    <ul className="flex flex-col gap-2" data-slot="imported-sources-grid">
      <AnimatePresence initial={false}>
        {sources.map((source) => (
          <SourceListItem
            key={source.id}
            match={matchesBySourceId.get(source.id)}
            source={source}
          />
        ))}
      </AnimatePresence>
    </ul>
  );
}

export { SourceListContent };

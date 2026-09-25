import { motion, useReducedMotion } from "motion/react";

import { Highlight } from "@/components/ui/highlight";

import type { EditingInstance } from "@/domain/editing-instance";

import { formatSourcePath } from "../../../lib/media-formatters.utils";
import type { SourceSearchResult } from "../../../lib/source-search.utils";
import {
  SourceCard,
  SourceCardDescription,
  SourceCardMetadata,
  SourceCardStatusBadge,
  SourceCardThumbnail,
  SourceCardTitle,
} from "../../SourceCard";

function SourceListItem({
  match,
  source,
}: {
  match: SourceSearchResult | undefined;
  source: EditingInstance;
}) {
  const shouldReduceMotion = useReducedMotion() === true;
  const duration = shouldReduceMotion ? 0 : 0.16;

  return (
    <motion.li
      animate={{ opacity: 1, y: 0 }}
      className="flex w-full min-w-0 flex-col"
      exit={{ opacity: 0, y: shouldReduceMotion ? 0 : -4 }}
      initial={shouldReduceMotion ? false : { opacity: 0, y: 4 }}
      layout={shouldReduceMotion ? false : "position"}
      transition={{ duration, ease: "easeOut" }}
    >
      <SourceListItemCard match={match} source={source} />
    </motion.li>
  );
}

function SourceListItemCard({
  match,
  source,
}: {
  match: SourceSearchResult | undefined;
  source: EditingInstance;
}) {
  return (
    <SourceCard className="flex min-w-0 flex-row gap-2 p-2" source={source}>
      <SourceCardThumbnail className="w-40 shrink-0 rounded-md">
        <SourceCardStatusBadge className="absolute top-1 left-1" />
      </SourceCardThumbnail>

      <div className="relative flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex min-w-0 flex-col gap-1" data-slot="card-header">
          <SourceCardTitle className="truncate">
            {({ source: cardSource }) => (
              <Highlight ranges={match?.displayNameRanges}>
                {cardSource.snapshot.source.displayName}
              </Highlight>
            )}
          </SourceCardTitle>
          <SourceCardDescription className="truncate">
            {({ source: cardSource }) => (
              <Highlight ranges={match?.sourcePathRanges}>
                {formatSourcePath(cardSource.snapshot.source.sourcePath)}
              </Highlight>
            )}
          </SourceCardDescription>
        </div>

        <SourceCardMetadata />
      </div>
    </SourceCard>
  );
}

export { SourceListItem };

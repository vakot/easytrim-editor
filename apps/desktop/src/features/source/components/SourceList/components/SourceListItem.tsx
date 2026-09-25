import { MoreHorizontal } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

import { Highlight } from "@/components/ui/highlight";

import type { EditingInstanceListEntry } from "@/domain/editing-instance";

import { formatSourcePath } from "../../../lib/media-formatters.utils";
import type { SourceSearchResult } from "../../../lib/source-search.utils";
import {
  SourceCard,
  SourceCardActions,
  SourceCardDescription,
  SourceCardMetadata,
  SourceCardStatusBadge,
  SourceCardThumbnail,
  SourceCardTitle,
} from "../../SourceCard";
import { useSourceListData } from "../contexts/SourceListContext";

function SourceListItem({
  match,
  source,
}: {
  match: SourceSearchResult | undefined;
  source: EditingInstanceListEntry;
}) {
  const { registerThumbnailDemand } = useSourceListData();
  const shouldReduceMotion = useReducedMotion() === true;
  const duration = shouldReduceMotion ? 0 : 0.16;

  return (
    <motion.li
      animate={{ opacity: 1, y: 0 }}
      className="flex w-full min-w-0 flex-col"
      exit={{ opacity: 0, y: shouldReduceMotion ? 0 : -4 }}
      initial={shouldReduceMotion ? false : { opacity: 0, y: 4 }}
      layout={shouldReduceMotion ? false : "position"}
      ref={(element) => registerThumbnailDemand(source, element)}
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
  source: EditingInstanceListEntry;
}) {
  return (
    <SourceCard className="relative flex min-w-0 flex-row gap-2 p-2" source={source}>
      <SourceCardThumbnail className="w-40 shrink-0 rounded-md">
        <SourceCardStatusBadge className="absolute top-1 left-1" />
      </SourceCardThumbnail>

      <div className="relative flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex min-w-0 flex-col gap-1" data-slot="card-header">
          <SourceCardTitle className="truncate">
            {({ source: cardSource }) => (
              <Highlight ranges={match?.displayNameRanges}>{cardSource.displayName}</Highlight>
            )}
          </SourceCardTitle>
          <SourceCardDescription className="truncate">
            {({ source: cardSource }) => (
              <Highlight ranges={match?.sourcePathRanges}>
                {formatSourcePath(cardSource.sourcePath)}
              </Highlight>
            )}
          </SourceCardDescription>
        </div>

        <SourceCardMetadata />
      </div>
      <SourceCardActions className="absolute top-2 right-2">
        <button
          aria-label={`Source actions: ${source.displayName}`}
          className="size-7 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          type="button"
        >
          <MoreHorizontal aria-hidden="true" className="mx-auto size-4" />
        </button>
      </SourceCardActions>
    </SourceCard>
  );
}

export { SourceListItem };

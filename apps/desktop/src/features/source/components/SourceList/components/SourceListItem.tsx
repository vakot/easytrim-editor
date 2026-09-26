import { MoreVertical } from "lucide-react";
import { motion } from "motion/react";

import { Button } from "@/components/ui/button";
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
import { SOURCE_LIST_CLOSE_ANIMATION_DURATION_MS } from "../contexts/SourceListContext";

function SourceListItem({
  isClosing,
  match,
  source,
}: {
  isClosing: boolean;
  match: SourceSearchResult | undefined;
  source: EditingInstanceListEntry;
}) {
  return (
    <motion.div
      animate={isClosing ? { opacity: 0, y: -4 } : { opacity: 1, y: 0 }}
      className="flex w-full min-w-0 flex-col"
      initial={false}
      role="listitem"
      transition={{ duration: SOURCE_LIST_CLOSE_ANIMATION_DURATION_MS / 1000, ease: "easeOut" }}
    >
      <SourceListItemCard match={match} source={source} />
    </motion.div>
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

        <SourceCardActions className="absolute right-0 bottom-0">
          <Button size="icon-sm" variant="ghost">
            <MoreVertical aria-hidden="true" className="mx-auto size-4" />
          </Button>
        </SourceCardActions>
      </div>
    </SourceCard>
  );
}

export { SourceListItem };

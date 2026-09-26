import { MoreVertical } from "lucide-react";

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

function SourceListItem({
  match,
  source,
}: {
  match: SourceSearchResult | undefined;
  source: EditingInstanceListEntry;
}) {
  return (
    <div className="flex w-full min-w-0 flex-col" role="listitem">
      <SourceListItemCard match={match} source={source} />
    </div>
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

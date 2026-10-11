import Fuse, { type IFuseOptions } from "fuse.js";

import type {
  ApplicationCommand,
  ApplicationCommandMatch,
} from "@/app/commands/core/application-command.types";
import { FUZZY_SEARCH_OPTIONS } from "@/lib/fuzzy-search.consts";

function filterApplicationCommands<Id extends string>(
  commands: readonly ApplicationCommand<Id>[],
  query: string,
): ApplicationCommandMatch<Id>[] {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) {
    return commands.map((command) => ({
      command,
      groupMatched: false,
      groupMatchRanges: [],
      labelMatched: false,
      labelMatchRanges: [],
      searchTermMatched: false,
    }));
  }

  return new Fuse(commands, commandSearchOptions)
    .search(normalizedQuery)
    .map(({ item: command, matches }) => {
      const labelMatchRanges = matches?.find(({ key }) => key === "label")?.indices ?? [];
      const groupMatchRanges = matches?.find(({ key }) => key === "group.label")?.indices ?? [];
      const searchTermMatched = matches?.some(({ key }) => key === "searchTerms") ?? false;

      return {
        command,
        groupMatched: groupMatchRanges.length > 0,
        groupMatchRanges,
        labelMatched: labelMatchRanges.length > 0,
        labelMatchRanges,
        searchTermMatched,
      };
    });
}

const commandSearchOptions = {
  includeMatches: true,
  keys: ["label", "group.label", "searchTerms"],
  ...FUZZY_SEARCH_OPTIONS,
} satisfies IFuseOptions<ApplicationCommand>;

export { filterApplicationCommands };

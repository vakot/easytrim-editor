const CHANGELOG_CATEGORIES = [
  "Added",
  "Changed",
  "Fixed",
  "Deprecated",
  "Removed",
  "Security",
] as const;

type ChangelogCategory = (typeof CHANGELOG_CATEGORIES)[number];

interface ChangelogSection {
  category: ChangelogCategory;
  entries: readonly string[];
}

interface ChangelogRelease {
  sections: readonly ChangelogSection[];
  version: string;
}

export { CHANGELOG_CATEGORIES };
export type { ChangelogCategory, ChangelogRelease, ChangelogSection };

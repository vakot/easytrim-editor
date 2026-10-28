import type { TFunction } from "i18next";
import { ScrollText } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@easytrim-editor/ui/empty";

import type { ChangelogCategory, ChangelogRelease } from "../types";

function ChangelogList({ releases }: { releases: readonly ChangelogRelease[] }) {
  if (!releases.length) return <ChangelogListEmpty />;

  return (
    <div className="space-y-8 py-4">
      {releases.map((release) => (
        <ChangelogReleaseItem key={release.version} release={release} />
      ))}
    </div>
  );
}

function ChangelogListEmpty() {
  const { t } = useTranslation();

  return (
    <Empty className="my-4">
      <EmptyHeader>
        <EmptyMedia>
          <ScrollText aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>{t("support.changelog.empty.title")}</EmptyTitle>
        <EmptyDescription>{t("support.changelog.empty.description")}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

function ChangelogReleaseItem({ release }: { release: ChangelogRelease }) {
  const { t } = useTranslation();

  return (
    <article className="space-y-4">
      <h2 className="border-b border-border/70 pb-2 font-heading text-base font-semibold tracking-tight">
        v{release.version}
      </h2>
      <div className="space-y-4 pl-3">
        {release.sections.map((section) => (
          <section className="space-y-1.5" key={`${release.version}-${section.category}`}>
            <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {translateCategory(t, section.category)}
            </h3>
            <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-foreground/90">
              {section.entries.map((entry) => (
                <li key={entry}>{entry}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </article>
  );
}

function translateCategory(t: TFunction, category: ChangelogCategory): string {
  switch (category) {
    case "Added":
      return t("support.changelog.categories.added");
    case "Changed":
      return t("support.changelog.categories.changed");
    case "Deprecated":
      return t("support.changelog.categories.deprecated");
    case "Fixed":
      return t("support.changelog.categories.fixed");
    case "Removed":
      return t("support.changelog.categories.removed");
    case "Security":
      return t("support.changelog.categories.security");
  }
}

export { ChangelogList };

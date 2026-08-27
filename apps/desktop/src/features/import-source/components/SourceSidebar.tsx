import {
  PaneView,
  PaneViewContent,
  PaneViewItem,
  PaneViewTrigger,
} from "@/components/layout/pane-view";

const PLACEHOLDER_ROWS = Array.from({ length: 20 }, (_, index) => index + 1);

export function SourceSidebar() {
  return (
    <aside className="h-full min-h-0 overflow-hidden p-1" aria-label="Source sidebar">
      <PaneView
        id="source-sidebar-sections"
        aria-label="Source sidebar sections"
        defaultValue={["media", "imported", "export"]}
      >
        <PaneViewItem id="media" defaultSize="33%" minSize={120}>
          <PaneViewTrigger>Media details</PaneViewTrigger>
          <PaneViewContent>
            <PlaceholderRows label="Media details" />
          </PaneViewContent>
        </PaneViewItem>

        <PaneViewItem id="imported" defaultSize="33%" minSize={120}>
          <PaneViewTrigger>Imported queue</PaneViewTrigger>
          <PaneViewContent>
            <PlaceholderRows label="Imported queue" />
          </PaneViewContent>
        </PaneViewItem>

        <PaneViewItem id="export" defaultSize="33%" minSize={120}>
          <PaneViewTrigger>Export queue</PaneViewTrigger>
          <PaneViewContent>
            <PlaceholderRows label="Export queue" />
          </PaneViewContent>
        </PaneViewItem>
      </PaneView>
    </aside>
  );
}

function PlaceholderRows({ label }: { label: string }) {
  return (
    <div className="space-y-1 p-2 text-xs text-muted-foreground">
      {PLACEHOLDER_ROWS.map((row) => (
        <p key={row}>
          {label} placeholder {row}
        </p>
      ))}
    </div>
  );
}

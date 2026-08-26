import {
  ResizableAccordion,
  ResizableAccordionContent,
  ResizableAccordionItem,
  ResizableAccordionTrigger,
} from "@/components/ui/resizable-accordion";

const PLACEHOLDER_ROWS = Array.from({ length: 20 }, (_, index) => index + 1);

export function SourceSidebar() {
  return (
    <aside className="h-full min-h-0 overflow-hidden p-1" aria-label="Source sidebar">
      <ResizableAccordion
        id="source-sidebar-sections"
        aria-label="Source sidebar sections"
        defaultValue={["media", "imported", "export"]}
      >
        <ResizableAccordionItem id="media" defaultSize="33%" minSize={120}>
          <ResizableAccordionTrigger>Media details</ResizableAccordionTrigger>
          <ResizableAccordionContent>
            <PlaceholderRows label="Media details" />
          </ResizableAccordionContent>
        </ResizableAccordionItem>

        <ResizableAccordionItem id="imported" defaultSize="33%" minSize={120}>
          <ResizableAccordionTrigger>Imported queue</ResizableAccordionTrigger>
          <ResizableAccordionContent>
            <PlaceholderRows label="Imported queue" />
          </ResizableAccordionContent>
        </ResizableAccordionItem>

        <ResizableAccordionItem id="export" defaultSize="33%" minSize={120}>
          <ResizableAccordionTrigger>Export queue</ResizableAccordionTrigger>
          <ResizableAccordionContent>
            <PlaceholderRows label="Export queue" />
          </ResizableAccordionContent>
        </ResizableAccordionItem>
      </ResizableAccordion>
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

import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const mock = [
  { filename: "History 1" },
  { filename: "History 2" },
  { filename: "History 3" },
  { filename: "History 4" },
  { filename: "History 5" },
];

export function ImportQueueTabs() {
  return (
    <Tabs>
      <div className="flex w-full justify-between">
        {/* TODO: on tab change - load selected snapshot */}
        <TabsList
          className="w-full justify-baseline rounded-b-none bg-preview-surface"
          defaultValue="History 1"
        >
          {mock.map((entry) => (
            // TODO: fix button in button composition error
            <TabsTrigger className="h-6 flex-0 text-xs" key={entry.filename} value={entry.filename}>
              {entry.filename}

              <Button
                onClick={(event) => {
                  event.stopPropagation();
                  // TODO: close snapshot
                }}
                size="icon-2xs"
                variant="ghost"
              >
                <X />
              </Button>
            </TabsTrigger>
          ))}
        </TabsList>
        <div className="flex gap-0.5 p-0.75">
          <Button size="xs" variant="secondary">
            Export
          </Button>
          <Button size="xs" variant="secondary">
            Save
          </Button>
        </div>
      </div>
    </Tabs>
  );
}

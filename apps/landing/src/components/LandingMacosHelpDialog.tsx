import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@easytrim-editor/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@easytrim-editor/ui/dialog";
import { ScrollArea } from "@easytrim-editor/ui/scroll-area";

/** Clears the quarantine flag macOS puts on downloads, which is what blocks an unsigned app. */
const UNQUARANTINE_COMMAND = 'xattr -dr com.apple.quarantine "/Applications/EasyTrim Editor.app"';
const COPIED_MS = 2_000;

function CopyCommand() {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPIED_MS);

    return () => clearTimeout(timer);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(UNQUARANTINE_COMMAND);
      setCopied(true);
    } catch {
      // The command stays selectable, so it can still be copied by hand.
    }
  }

  return (
    <div className="flex items-center gap-1 rounded-md border bg-muted/40 pr-1">
      <ScrollArea className="min-w-0 flex-1" orientation="horizontal">
        <code className="block px-2.5 py-2 font-mono text-xs whitespace-nowrap text-foreground select-all">
          {UNQUARANTINE_COMMAND}
        </code>
      </ScrollArea>
      <Button
        aria-label="Copy the command"
        onClick={copy}
        size="icon-xs"
        title="Copy the command"
        variant="ghost"
      >
        {copied ? (
          <Check aria-hidden="true" className="text-success" />
        ) : (
          <Copy aria-hidden="true" />
        )}
      </Button>
      <span aria-live="polite" className="sr-only">
        {copied ? "Copied" : ""}
      </span>
    </div>
  );
}

type LandingMacosHelpDialogProps = {
  onCloseAutoFocus: (event: Event) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

/**
 * macOS builds are not signed with an Apple Developer certificate, so Gatekeeper blocks the first
 * launch. This shows how to allow it, from System Settings or the terminal. It is loaded on demand
 * by `LandingMacosHelp`, hence the default export.
 */
function LandingMacosHelpDialog({
  onCloseAutoFocus,
  onOpenChange,
  open,
}: LandingMacosHelpDialogProps) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md" onCloseAutoFocus={onCloseAutoFocus}>
        <DialogHeader>
          <DialogTitle>Opening EasyTrim Editor on macOS</DialogTitle>
          <DialogDescription>
            The app isn&rsquo;t signed with an Apple certificate yet, so macOS blocks the first
            launch.
          </DialogDescription>
        </DialogHeader>
        <ol className="ml-4 grid list-decimal gap-1.5 text-sm text-muted-foreground marker:text-foreground">
          <li>Open the app, then close the warning.</li>
          <li>
            In <strong className="font-medium text-foreground">System Settings</strong> &rarr;{" "}
            <strong className="font-medium text-foreground">Privacy &amp; Security</strong>, click{" "}
            <strong className="font-medium text-foreground">Open Anyway</strong>.
          </li>
        </ol>
        <div className="flex flex-col gap-2 text-sm text-muted-foreground">
          <p>Or run this in Terminal, which also fixes &ldquo;damaged&rdquo; errors:</p>
          <CopyCommand />
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default LandingMacosHelpDialog;

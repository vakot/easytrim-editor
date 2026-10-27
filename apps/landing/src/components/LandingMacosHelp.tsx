import { Check, ChevronDown, Copy } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@easytrim-editor/ui/button";

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
    <div className="mt-2 flex items-start gap-1 rounded-md border bg-muted/40 py-1 pr-1 pl-2.5">
      <code className="min-w-0 flex-1 overflow-x-auto py-1 font-mono text-xs whitespace-nowrap text-foreground select-all">
        {UNQUARANTINE_COMMAND}
      </code>
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

/**
 * macOS builds are not signed with an Apple Developer certificate, so Gatekeeper blocks the first
 * launch. This walks through allowing it, by the settings screen or by the terminal.
 */
function LandingMacosHelp() {
  return (
    <details className="group mt-4 rounded-lg border bg-background/40 text-sm">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg px-3 py-2 font-medium outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
        <span className="flex-1">Can&rsquo;t open it on macOS?</span>
        <ChevronDown
          aria-hidden="true"
          className="size-4 text-muted-foreground transition-transform group-open:rotate-180"
        />
      </summary>
      <div className="flex flex-col gap-3 px-3 pb-3 text-xs leading-relaxed text-muted-foreground">
        <p>
          EasyTrim Editor isn&rsquo;t signed with an Apple Developer certificate yet, so macOS asks
          you to confirm the first launch. It is safe to allow:
        </p>
        <ol className="ml-4 grid list-decimal gap-1.5 marker:text-foreground">
          <li>
            Drag EasyTrim Editor to Applications and open it. When macOS warns that it can’t be
            verified, close the message.
          </li>
          <li>
            Open <strong className="font-medium text-foreground">System Settings</strong>, then{" "}
            <strong className="font-medium text-foreground">Privacy &amp; Security</strong>. Under
            Security, choose <strong className="font-medium text-foreground">Open Anyway</strong>{" "}
            next to EasyTrim Editor and confirm. On macOS 14 and earlier you can right-click the app
            and choose Open instead.
          </li>
        </ol>
        <div>
          <p>
            Or, after moving the app to Applications, run this once in Terminal. It also fixes a
            &ldquo;damaged and can&rsquo;t be opened&rdquo; message:
          </p>
          <CopyCommand />
        </div>
      </div>
    </details>
  );
}

export { LandingMacosHelp };

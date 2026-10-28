import { CircleHelp } from "lucide-react";
import { Suspense, useRef, useState } from "react";

import { Button } from "@easytrim-editor/ui/button";
import { lazyWithPreload, preloadOnIntent } from "@easytrim-editor/ui/lazy-component";

const LazyDialog = lazyWithPreload(() => import("./LandingMacosHelpDialog"));

/** Fetches the dialog when a visitor shows interest, so it opens at once when they click. */
const preloadDialog = preloadOnIntent(() => LazyDialog.preload());

/**
 * A button that opens the steps for allowing the unsigned macOS app. Few visitors need them, so the
 * dialog, and the dialog library behind it, load only on demand.
 */
function LandingMacosHelp() {
  const trigger = useRef<HTMLButtonElement>(null);
  const [requested, setRequested] = useState(false);
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        aria-haspopup="dialog"
        className="mt-4 w-full justify-start"
        onClick={() => {
          setRequested(true);
          setOpen(true);
        }}
        onFocus={preloadDialog}
        onPointerEnter={preloadDialog}
        ref={trigger}
        size="lg"
        variant="outline"
      >
        <CircleHelp aria-hidden="true" className="text-muted-foreground" />
        Can&rsquo;t open it on macOS?
      </Button>
      {requested && (
        <Suspense fallback={null}>
          <LazyDialog
            onCloseAutoFocus={(event) => {
              // There is no Radix trigger to return to, so hand focus back to the button.
              event.preventDefault();
              trigger.current?.focus();
            }}
            onOpenChange={setOpen}
            open={open}
          />
        </Suspense>
      )}
    </>
  );
}

export { LandingMacosHelp };

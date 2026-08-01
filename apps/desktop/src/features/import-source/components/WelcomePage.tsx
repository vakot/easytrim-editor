import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { SessionState } from "@/app/session-state";
import { CapabilityStatus } from "./CapabilityStatus";
import { DropOverlay } from "./DropOverlay";
import { SourceError } from "./SourceError";
import { WelcomeBrandWall } from "./WelcomeBrandWall";

interface WelcomePageProps {
  session: SessionState;
  isChoosingSource: boolean;
  isSourceDragActive: boolean;
  onChooseSource: () => void;
}

export function WelcomePage({
  session,
  isChoosingSource,
  isSourceDragActive,
  onChooseSource,
}: WelcomePageProps) {
  return (
    <section
      className="relative isolate grid min-h-0 place-items-center overflow-hidden"
      aria-labelledby="import-title"
    >
      <WelcomeBrandWall />
      <Card className="relative z-10 w-[min(27rem,calc(100vw-2rem))] border-border/80 bg-card/96 shadow-2xl backdrop-blur-md">
        <CardHeader className="text-center">
          <p className="text-xs font-bold tracking-[0.14em] text-primary uppercase">
            Start a new clip
          </p>
          <h2 id="import-title" className="font-heading text-2xl font-semibold">
            Open a video
          </h2>
          <CardDescription>Import one source and start cutting immediately.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-3 rounded-xl border border-dashed border-border p-3 text-center">
            <Button
              size="lg"
              className="w-full"
              onClick={onChooseSource}
              disabled={isChoosingSource}
            >
              {isChoosingSource ? "Opening…" : "Select video"}
            </Button>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <Separator className="flex-1" />
              <span>or</span>
              <Separator className="flex-1" />
            </div>
            <p className="text-sm text-muted-foreground">Drop a supported video here</p>
          </div>
          <p className="text-center text-xs text-muted-foreground">
            MP4, MOV, MKV, WebM, AVI, TS, MTS, M2TS, M4V, WMV, FLV
          </p>
          <div className="flex justify-center">
            <CapabilityStatus capabilities={session.capabilities} />
          </div>
        </CardContent>
      </Card>

      {session.lastError ? (
        <div className="absolute bottom-4 z-20 w-[min(34rem,calc(100vw-2rem))]">
          <SourceError error={session.lastError} />
        </div>
      ) : null}
      {isSourceDragActive ? <DropOverlay /> : null}
    </section>
  );
}

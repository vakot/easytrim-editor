import type { SessionState } from "@/app/session-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function SourceError({ error }: { error: NonNullable<SessionState["lastError"]> }) {
  return (
    <Alert variant="destructive" role="alert">
      <AlertTitle>Could not load this video</AlertTitle>
      <AlertDescription className="grid gap-2">
        <p>{error.message}</p>
        {error.diagnostics ? (
          <details>
            <summary>Technical details</summary>
            <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-md bg-black/25 p-2 font-mono text-xs">
              {error.diagnostics}
            </pre>
          </details>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}

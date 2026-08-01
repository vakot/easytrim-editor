import type { SessionState } from "@/app/session-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useTranslation } from "react-i18next";

export function SourceError({ error }: { error: NonNullable<SessionState["lastError"]> }) {
  const { t } = useTranslation();

  return (
    <Alert variant="destructive" role="alert">
      <AlertTitle>{t("import.source.loadError")}</AlertTitle>
      <AlertDescription className="grid gap-2">
        <p>{error.message}</p>
        {error.diagnostics ? (
          <details>
            <summary>{t("import.source.technicalDetails")}</summary>
            <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-md bg-black/25 p-2 font-mono text-xs">
              {error.diagnostics}
            </pre>
          </details>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}

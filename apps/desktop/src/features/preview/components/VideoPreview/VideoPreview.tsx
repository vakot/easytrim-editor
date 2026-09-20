import { AlertCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import { selectPreview } from "@/app/store/slices/preview-slice";
import { closeActiveEditingInstanceRequested } from "@/app/store/thunks/source-media-thunks";

import { CropViewport } from "../CropViewport";

export function VideoPreview() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const preview = useAppSelector(selectPreview);
  const skipCurrentSource = () => void dispatch(closeActiveEditingInstanceRequested());

  if (preview.status === "idle" || preview.status === "loading") {
    return <div aria-hidden="true" className="size-full bg-preview-surface" />;
  }

  if (preview.status === "failed") {
    return (
      <div className="flex h-full items-center justify-center">
        <Alert className="max-w-md" variant="destructive">
          <AlertCircle />
          <AlertTitle>{t("preview.messages.error")}</AlertTitle>
          <AlertDescription>
            <p>{preview.error.message}</p>
            {preview.error.diagnostics ? (
              <details className="mt-2">
                <summary>{t("source.labels.technicalDetails")}</summary>
                <pre className="mt-2 max-h-48 overflow-auto text-xs whitespace-pre-wrap">
                  {preview.error.diagnostics}
                </pre>
              </details>
            ) : null}
          </AlertDescription>
          <AlertAction>
            <Button className="mt-3" onClick={skipCurrentSource} size="sm" variant="outline">
              {t("queue.actions.skip")}
            </Button>
          </AlertAction>
        </Alert>
      </div>
    );
  }

  const { value } = preview;

  return (
    <section className="grid size-full min-h-0 place-items-center">
      <div className="relative size-full min-h-0 overflow-hidden bg-preview-surface">
        <CropViewport key={value.url} />
        {value.kind === "proxy" ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                className="absolute top-3 right-3 cursor-help"
                role="status"
                tabIndex={0}
                variant="secondary"
              >
                {t("preview.labels.compatible")}
              </Badge>
            </TooltipTrigger>
            <TooltipContent className="max-w-2xs text-center whitespace-normal" sideOffset={6}>
              {t("preview.messages.proxy")}
            </TooltipContent>
          </Tooltip>
        ) : null}
      </div>
    </section>
  );
}

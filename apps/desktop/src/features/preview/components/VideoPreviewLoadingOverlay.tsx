import { LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Backdrop } from "@/components/ui/backdrop";
import { Button } from "@/components/ui/button";

import { usePlayback } from "@/app/hooks/usePlayback";
import { useAppSelector } from "@/app/store/redux-hooks";
import { selectPreview } from "@/app/store/slices/preview-slice";
import { selectSourceLoadToken, selectSourceSelection } from "@/app/store/slices/source-slice";

interface VideoPreviewLoadingOverlayProps {
  onSkip: () => void;
}

export function VideoPreviewLoadingOverlay({ onSkip }: VideoPreviewLoadingOverlayProps) {
  const { t } = useTranslation();

  const playback = usePlayback();

  const sourceSelection = useAppSelector(selectSourceSelection);
  const sourceLoadToken = useAppSelector(selectSourceLoadToken);
  const preview = useAppSelector(selectPreview);

  const transitionKey = `${sourceLoadToken}:${sourceSelection?.sourcePath ?? "no-source"}`;
  const [completedTransitionKey, setCompletedTransitionKey] = useState<string | null>(null);

  const showLoadingOverlay =
    sourceSelection !== null &&
    (preview.status === "loading" ||
      (preview.status === "ready" &&
        completedTransitionKey !== transitionKey &&
        !playback.isReady));

  const [skipAvailableFor, setSkipAvailableFor] = useState<string | null>(null);

  useEffect(() => {
    if (sourceSelection !== null && preview.status === "ready" && playback.isReady) {
      // Playback becoming ready completes this source transition. Later audio-route
      // reconfiguration must not revive the source-opening overlay.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCompletedTransitionKey(transitionKey);
    }
  }, [playback.isReady, preview.status, sourceSelection, transitionKey]);

  useEffect(() => {
    if (!showLoadingOverlay) return;
    const timeout = window.setTimeout(() => setSkipAvailableFor(transitionKey), 3_000);
    return () => window.clearTimeout(timeout);
  }, [showLoadingOverlay, transitionKey]);

  if (!showLoadingOverlay) return null;

  return (
    <Backdrop className="absolute" data-testid="preview-loading-overlay">
      <div className="grid place-items-center gap-3">
        <LoaderCircle aria-hidden="true" className="size-7 animate-spin text-primary" />
        <strong className="text-foreground">
          {preview.status === "loading" && preview.kind === "proxy"
            ? t("preview.status.preparing")
            : t("preview.status.opening")}
        </strong>
        {skipAvailableFor === transitionKey ? (
          <Button onClick={onSkip} size="sm" variant="outline">
            {t("queue.actions.skip")}
          </Button>
        ) : null}
      </div>
    </Backdrop>
  );
}
